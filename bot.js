const Discord = require('discord.js');
const fs = require('fs');
const lzutf8 = require('lzutf8');
const auth = require('./auth.json');
const {TPStoCanvas} = require('./TPS-Ninja/src');

const client = new Discord.Client();
const theme = "discord";

async function getGameMessages(msg) {
    let messages = await msg.channel.messages.fetch();
    return messages.filter(m => m.author.id === client.user.id).filter(m => m.attachments.array().length != 0);
}

function getEncodedHashFromGameMessage(msg) {
    return msg.content.split('||')[1];
}

function getDataFromEncodedHash(encodedHash) {
    let gameHash = lzutf8.decompress(decodeURI(encodedHash.replaceAll('_', '/')), {'inputEncoding': 'Base64'});
    let playersString = gameHash.split('___')[0];
    let players = playersString.split('_');
    let tps = gameHash.split('___')[1];
    let turnMarker = tps.split('__')[1];
    tps = tps.replaceAll('__', ' ').replaceAll('_', ',').replaceAll('-', '/');
    return {
        'player1': players[0],
        'player2': players[1],
        'tps': tps,
        'turnMarker': turnMarker
    };
}

function encodeHashFromData(gameData) {
    let gameHash = gameData.player1 + '_' + gameData.player2 + '___' + gameData.tps.replaceAll('/', '-').replaceAll(',', '_').replaceAll(' ', '__');
    return encodeURI(lzutf8.compress(gameHash, {'outputEncoding': 'Base64'})).replaceAll('/', '_');
}

async function fetchPlayerData(gameData) {
    let player1 = await client.users.fetch(gameData.player1);
    let player2 = await client.users.fetch(gameData.player2);
    return {
        'player1': player1.username,
        'player2': player2.username
    };
}

function sendPngToDiscord(msg, canvas, messageComment) {
    let filename = msg.channel.id + '.png';
    let out = fs.createWriteStream(filename);
    let stream = canvas.pngStream();
    stream.pipe(out);
    out.on('finish', () => {
        msg.channel.send(messageComment, {
            files: [{
                attachment: filename,
                name: filename
            }]
        })
        .then(() => {
            fs.unlink(filename, (err) => {
                if (err) console.log(error);
            });
        })
        .catch(console.error);
    });
}

function handleHelp(msg) {
    msg.channel.send('Use `!tak @opponent (optional 3-8 to set size)` to start a new game.\
        \nThe challenged player gets to move first.\
        \n\nThe bot tracks games through the last move in the channel and can only see 50 message back.\
        \nIf you want to run multiple games at once, please use different channels.\
        \n\nExample commands:\
        \n```!tak help\
        \n!tak @opponent\
        \n!tak @opponent <size>\
        \n!tak undo\
        \n!tak link\
        \n<while playing, any valid ply on its own line>```');
}

async function handleUndo(msg) {
    let messages = await getGameMessages(msg);
    if (messages.array().length == 0) {
        msg.channel.send('You need to have a game in progress before undo will work.');
        return;
    }

    let message = messages.first();
    let encodedHash = getEncodedHashFromGameMessage(message);
    if (!encodedHash) {
        msg.channel.send('You cannot undo a completed game.');
        return;
    }

    let gameData = getDataFromEncodedHash(encodedHash);

    if (msg.author.id != gameData.player1 && msg.author.id != gameData.player2) {
        return;
    }

    if ((gameData.turnMarker == '1' && msg.author.id != gameData.player2)
            || (gameData.turnMarker == '2' && msg.author.id != gameData.player1)) {
        msg.channel.send('You cannot undo a move that is not your own.');
        retturn;
    }

    message.delete();
}

async function handleLink(msg) {
    let messages = await getGameMessages(msg);
    if (messages.array().length == 0) {
        msg.channel.send('You need to have a game in progress before link will work.');
        return;
    }

    let message = messages.first();
    let encodedHash = getEncodedHashFromGameMessage(message);
    if (!encodedHash) {
        msg.channel.send('You cannot get a TPS link to a completed game.');
        return;
    }

    let gameData = getDataFromEncodedHash(encodedHash);
    let playerData = await fetchPlayerData(gameData);
    msg.channel.send(encodeURI('https://ptn.ninja/[TPS "' + gameData.tps + '"][Player1 "' + playerData.player1 + '"][Player2 "' + playerData.player2 + '"]'));
}

function handleNew(msg, args) {
    if (msg.mentions.users.array().length != 1) {
        msg.channel.send('I didn\'t understand. See `!tak help` for example commands.');
    } else {
        let player1 = msg.mentions.users.first();
        let player2 = msg.author;
        let size = (args[1]) ? args[1] : '6';
        if (size !== '3' && size !== '4' && size !== '5' && size !== '6' && size !== '7' && size !== '8') {
            msg.channel.send('Invalid board size.');
            return;
        }
        let canvas;
        try {
            canvas = TPStoCanvas({
                'tps': size,
                'player1': player1.username,
                'player2': player2.username,
                'padding': false,
                'theme': theme
            });
        } catch (error) {
            msg.channel.send('An issue occurred while generating the starting board.');
            return;
        }

        let encodedHash = encodeHashFromData({'player1': player1.id, 'player2': player2.id, 'tps': canvas.id});
        let messageComment = 'Type a valid move in ptn notation to play. (<https://ustak.org/portable-tak-notation/>)\n||' + encodedHash + '||';
        sendPngToDiscord(msg, canvas, messageComment);
    }
}

function validPly(cmd) {
    return (cmd.match(/(\d)?([CcSs])?([a-hA-H])([1-8])(([<>+-])([1-8]+)?(\*)?)?/i)) ? true : false;
}

async function handleMove(msg, ply) {
    let messages = await getGameMessages(msg);
    if (messages.array().length == 0) {
        return;
    }

    let message = messages.first();
    let encodedHash = getEncodedHashFromGameMessage(message);
    if (!encodedHash) {
        return;
    }

    let gameData = getDataFromEncodedHash(encodedHash);

    if (msg.author.id != gameData.player1 && msg.author.id != gameData.player2) {
        return;
    }

    if ((gameData.turnMarker == '1' && msg.author.id != gameData.player1)
            || (gameData.turnMarker == '2' && msg.author.id != gameData.player2)) {
        msg.channel.send('You are not the active player.');
        return;
    }

    let playerData = await fetchPlayerData(gameData);
    let canvas;
    try {
        canvas = TPStoCanvas({
            'tps': gameData.tps,
            'ply': ply,
            'player1': playerData.player1,
            'player2': playerData.player2,
            'padding': false,
            'theme': theme
        });
    } catch (error) {
        console.log(error);
        msg.channel.send('Invalid move.');
        return;
    }

    let nextPlayer = gameData.player1;
    if (gameData.turnMarker == '1') nextPlayer = gameData.player2;

    encodedHash = encodeHashFromData({'player1': gameData.player1, 'player2': gameData.player2, 'tps': canvas.id});
    let messageComment = 'Your turn, <@'+nextPlayer+'>\n||' + encodedHash + '||';
    if (canvas.isGameEnd) {
        messageComment = 'GG <@'+nextPlayer+'>! Game Ended ' + canvas.id;
    }

    sendPngToDiscord(msg, canvas, messageComment);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    let message = msg.content;
    if (message.length >= 4 && message.substring(0, 4) == '!tak') {
        let args = message.substring(5).split(' ');
        let cmd = args[0];
        switch(cmd) {
            case 'help':
                handleHelp(msg);
                break;
            case 'undo':
                handleUndo(msg);
                break;
            case 'link':
                handleLink(msg);
                break;
            default:
                handleNew(msg, args);
                break;
        }
    } else {
        let args = message.split(' ');
        if (args.length != 1) return;
        if (!validPly(args[0])) return;
        handleMove(msg, args[0]);
    }
});

client.login(auth.token);
