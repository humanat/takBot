const Discord = require('discord.js');
const fs = require('fs');
const lzutf8 = require('lzutf8');
const crypto = require('crypto');
const auth = require('./auth.json');
const parser = require('minimist');
const {TPStoCanvas} = require('./TPS-Ninja/src');
const {once} = require('events');
const {compressToEncodedURIComponent} = require('lz-string');

const client = new Discord.Client();
const theme = "discord";



// Helper functions

function validPly(cmd) {
    return (cmd.match(/^(\d)?([CcSs])?([a-hA-H])([1-8])(([<>+-])([1-8]+)?(\*)?)?$/i)) ? true : false;
}

function getEncodedHashFromFile(msg) {
    let dirname = 'data/' + msg.channel.id;
    try {
        let files = fs.readdirSync(dirname);
        files.sort();
        let filename = files[files.length-1];
        filename = 'data/' + msg.channel.id + '/' + filename;
        return fs.readFileSync(filename, 'utf8');
    } catch (err) {
        // On error we assume that the file doesn't exist
    }
}

function saveEncodedHashToFile(msg, encodedHash) {
    let dirname = 'data/' + msg.channel.id;
    try {
        fs.mkdirSync(dirname, {recursive:true});
    } catch (err) {
        console.log(err);
    }
    let filename = Date.now() + crypto.randomBytes(2).toString("hex");
    if (20 - filename.length > 0) {
        for (let i = 0; i < 20-filename.length; i++) {
            filename = '0' + filename;
        }
    }
    filename = 'data/' + msg.channel.id + '/' + filename + '.data';
    try {
        fs.writeFileSync(filename, encodedHash);
    } catch (err) {
        console.log(err);
    }
}

function deleteEncodedHashFile(msg) {
    let dirname = 'data/' + msg.channel.id;
    try {
        let files = fs.readdirSync(dirname);
        files.sort();
        let filename = files[files.length-1];
        filename = 'data/' + msg.channel.id + '/' + filename;
        fs.unlinkSync(filename);
    } catch (err) {
        console.log(err);
    }
}

function checkForOngoingGame(msg) {
    let dirname = 'data/' + msg.channel.id;
    return fs.existsSync(dirname);
}

function cleanupFiles(msg) {
    let dirname = 'data/' + msg.channel.id;
    try {
        fs.rmdirSync(dirname, {recursive:true, force:true});
    } catch (err) {
        console.log(err);
    }
}

function getDataFromEncodedHash(encodedHash) {
    let gameHash = lzutf8.decompress(decodeURI(encodedHash.replace(/_/g, '/')), {'inputEncoding': 'Base64'}).split('___');
    let playersString = gameHash[0];
    let players = playersString.split('_');
    let tps = gameHash[1] || "";
    let turnMarker = tps.split('__')[1];
    tps = tps.replace(/__/g, ' ').replace(/_/g, ',').replace(/-/g, '/');
    let komi = gameHash[2] || 0;
    let gameId = gameHash[3] || 0;
    let opening = gameHash[4] || 'swap';
    return {
        'player1': players[0],
        'player2': players[1],
        'tps': tps,
        'turnMarker': turnMarker,
        'komi': komi,
        'gameId': gameId,
        'opening': opening
    };
}

function encodeHashFromData(gameData) {
    let gameHash = gameData.player1 + '_' + gameData.player2
            + '___' + gameData.tps.replace(/\//g, '-').replace(/,/g, '_').replace(/ /g, '__')
            + '___' + gameData.komi
            + '___' + gameData.gameId
            + '___' + gameData.opening
    return encodeURI(lzutf8.compress(gameHash, {'outputEncoding': 'Base64'})).replace(/\//g, '_');
}

function createPtnFile(gameData) {
    try {
        fs.mkdirSync('ptn', {recursive:true});
    } catch (err) {
        console.log(err);
    }

    let gameId = Date.now() + crypto.randomBytes(2).toString("hex");
    let filename = 'ptn/' + gameId + '.ptn';
    let data = '[Player1 "' + gameData.player1 + '"]'
        + '[Player2 "' + gameData.player2 + '"]'
        + '[Size "' + gameData.size + '"]'
        + '[Komi "' + gameData.komi + '"]'
        + '[Opening "' + gameData.opening + '"]';
    try {
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.log(err);
    }
    return gameId;
}

function addPlyToPtnFile(gameId, ply) {
    ply = ply.toLowerCase();
    if (ply.match(/[c][a-h][1-8]/)) {
        ply = ply.replace('c', 'C');
    } else if (ply.match(/[s][a-h][1-8]/)) {
        ply = ply.replace('s', 'S');
    }

    let filename = 'ptn/' + gameId + '.ptn';
    try {
        let data = fs.readFileSync(filename, 'utf8');
        data = data + ' ' + ply;
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.log(err);
    }
}

function removeLastPlyFromPtnFile(gameId) {
    let filename = 'ptn/' + gameId + '.ptn';
    try {
        let data = fs.readFileSync(filename, 'utf8');
        data = data.substr(0, data.lastIndexOf(' '));
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.log(err);
    }
}

function getPtnFromFile(gameId) {
    let filename = 'ptn/' + gameId + '.ptn';
    try {
        return fs.readFileSync(filename, 'utf8');
    } catch (err) {
        if (!err.message.includes('no such file or directory')) {
            console.log(err);
        }
    }
}

function addToHistoryFile(gameData) {
    let filename = 'results.db';
    let resultString = gameData.gameId + ', ' + gameData.player1 + ', ' + gameData.player2 + ', ' + gameData.komi + ', ' + gameData.opening + ', ' + gameData.result + '\n';
    try {
        fs.appendFileSync(filename, resultString);
    } catch (err) {
        console.log(err);
    }
}

function getHistoryFromFile(page) {
    try {
        if (isNaN(page) || page < 1) { return; }
        let filename = 'results.db';
        let gamesPerPage = 10;
        let history = fs.readFileSync(filename, 'utf8');
        let historyArray = history.split('\n');
        let header = historyArray[0];
        historyArray.shift();
        while (historyArray[historyArray.length-1] == "") { historyArray.pop(); }
        let numPages = Math.ceil(historyArray.length/gamesPerPage);
        if (page > numPages) { return; }
        historyArray = historyArray.reverse();
        historyArray = historyArray.slice((page-1)*gamesPerPage, page*gamesPerPage);
        history = 'page ' + page + ' of ' + numPages + '\n\n' + header + '\n' + historyArray.join('\n');
        return history;
    } catch (err) {
        console.log(err);
    }
}



// Getter functions for reading from Discord

async function getGameMessages(msg) {
    let messages = await msg.channel.messages.fetch();
    return messages.filter(m => m.author.id === client.user.id).filter(m => m.attachments.array().length != 0);
}

async function fetchPlayerData(gameData) {
    const result = {};
    await Promise.all([
        client.users.fetch(gameData.player1).then(
            (player1) => { result.player1 = player1.username; }
        ),
        client.users.fetch(gameData.player2).then(
            (player2) => { result.player2 = player2.username; }
        )
    ]);
    return result;
}



// Functions to send to Discord

async function sendPngToDiscord(msg, canvas, messageComment) {
    try {
        fs.mkdirSync('images', {recursive:true});
    } catch (err) {
        console.log(err);
    }
    let filename = 'images/' + msg.channel.id + '.png';
    let out = fs.createWriteStream(filename);
    let stream = canvas.pngStream();
    stream.pipe(out);
    await once(out, 'finish');
    try {
        await msg.channel.send(messageComment, {
            files: [{
                attachment: filename,
                name: filename
            }]
        });
    } catch (err) {
        console.log(err);
    }
    fs.unlink(filename, (err) => {
        if (err) console.log(err);
    });
}

async function sendMessage(msg, content) {
    try {
        if (typeof content == "string" && content.length <= 2000) {
            await msg.channel.send(content);
        } else {
            await msg.channel.send('takBot attempted to send a message that was over 2000 characters in length and failed.');
        }
    } catch (err) {
        console.log(err);
    }
}



// Major handler methods

function handleNew(msg, options) {
    if (msg.mentions.users.array().length != 1) {
        sendMessage(msg, 'I didn\'t understand. See `!tak help` for example commands.');
    } else if (checkForOngoingGame(msg)) {
        sendMessage(msg, 'You cannot overwrite an ongoing game. Use `!tak end` if you are sure that no one is using this channel.');
    } else {
        let player1;
        let player2;
        if (options.white || (options.random && Math.random() < 0.5)) {
            player1 = msg.author;
            player2 = msg.mentions.users.first();
        } else {
            player1 = msg.mentions.users.first();
            player2 = msg.author;
        }

        let size = options.size ? options.size : 6;
        if (size < 3 || size > 8) {
            sendMessage(msg, 'Invalid board size.');
            return;
        }

        let komi = options.komi ? options.komi : 0;
        if (komi < -20.5 || komi > 20.5) {
            sendMessage(msg, 'Invalid komi.');
            return;
        }

        let opening = options.opening ? options.opening : 'swap';
        if (opening != 'swap' && opening != 'no-swap') {
            sendMessage(msg, 'Invalid opening.');
            return;
        }

        let canvas;
        try {
            canvas = TPStoCanvas({
                'tps': size,
                'komi': komi,
                'player1': player1.username,
                'player2': player2.username,
                'padding': false,
                'theme': theme,
                'opening': opening
            });
        } catch (error) {
            sendMessage(msg, 'An issue occurred while generating the starting board.');
            return;
        }

        let gameId = createPtnFile({'player1': player1.username, 'player2': player2.username, 'size': size, 'komi': komi, 'opening': opening});
        let encodedHash = encodeHashFromData({'player1': player1.id, 'player2': player2.id, 'tps': canvas.id, 'komi': komi, 'gameId': gameId, 'opening': opening});
        let messageComment = 'Type a valid move in ptn notation to play. (<https://ustak.org/portable-tak-notation/>)';
        saveEncodedHashToFile(msg, encodedHash);
        sendPngToDiscord(msg, canvas, messageComment);
    }
}

function handleEnd(msg) {
    if (checkForOngoingGame(msg)) {
        cleanupFiles(msg);
        sendMessage(msg, 'Ongoing game in this channel has been removed.');
    } else {
        sendMessage(msg, 'There is no ongoing game in this channel.');
    }
}

async function handleMove(msg, ply) {
    let encodedHash = getEncodedHashFromFile(msg);
    if (!encodedHash) return;

    let gameData = getDataFromEncodedHash(encodedHash);

    if (msg.author.id != gameData.player1 && msg.author.id != gameData.player2) {
        return;
    }

    if ((gameData.turnMarker == '1' && msg.author.id != gameData.player1)
            || (gameData.turnMarker == '2' && msg.author.id != gameData.player2)) {
        sendMessage(msg, 'You are not the active player.');
        return;
    }

    let playerData = await fetchPlayerData(gameData);
    let canvas;
    try {
        canvas = TPStoCanvas({
            'tps': gameData.tps,
            'ply': ply,
            'komi': gameData.komi,
            'player1': playerData.player1,
            'player2': playerData.player2,
            'padding': false,
            'theme': theme,
            'opening': gameData.opening
        });
    } catch (err) {
        if (!err.message.includes('Invalid')) {
            console.log(err);
        }
        sendMessage(msg, 'Invalid move.');
        return;
    }
    if (gameData.gameId != 0) addPlyToPtnFile(gameData.gameId, ply);

    let nextPlayer = gameData.player1;
    if (gameData.turnMarker == '1') nextPlayer = gameData.player2;

    let messageComment = 'Your turn '+canvas.linenum+', <@'+nextPlayer+'>';
    if (canvas.isGameEnd) {
        messageComment = 'GG <@'+nextPlayer+'>! Game Ended ' + canvas.id;
        cleanupFiles(msg);
        if (gameData.gameId != 0) addToHistoryFile({'gameId': gameData.gameId, 'player1': playerData.player1, 'player2': playerData.player2, 'komi': gameData.komi, 'opening': gameData.opening, 'result': canvas.id});
    } else {
        encodedHash = encodeHashFromData({'player1': gameData.player1, 'player2': gameData.player2, 'tps': canvas.id, 'komi': gameData.komi, 'gameId': gameData.gameId, 'opening': gameData.opening});
        saveEncodedHashToFile(msg, encodedHash);
    }

    await sendPngToDiscord(msg, canvas, messageComment);

    if (canvas.isGameEnd) {
        await sendMessage(msg, 'Here\'s a link to the completed game:');
        handleLink(msg, gameData.gameId);
    }
}

async function handleUndo(msg) {
    let encodedHash = getEncodedHashFromFile(msg);
    if (!encodedHash) {
        sendMessage(msg, 'You cannot undo a completed game.');
        return;
    }

    let gameData = getDataFromEncodedHash(encodedHash);

    if (msg.author.id != gameData.player1 && msg.author.id != gameData.player2) {
        return;
    }

    if ((gameData.turnMarker == '1' && msg.author.id != gameData.player2)
            || (gameData.turnMarker == '2' && msg.author.id != gameData.player1)) {
        sendMessage(msg, 'You cannot undo a move that is not your own.');
        return;
    }

    let messages = await getGameMessages(msg);
    if (messages.array().length >= 0) {
        let message = messages.first();
        message.delete();
    }

    if (gameData.gameId != 0) removeLastPlyFromPtnFile(gameData.gameId);
    deleteEncodedHashFile(msg);
    sendMessage(msg, 'Undo complete.');
}

async function handleLink(msg, gameId) {
    if (!gameId) {
        let encodedHash = getEncodedHashFromFile(msg);
        if (!encodedHash) {
            sendMessage(msg, 'You must use the gameId to get a link for a completed game. See `!tak history` to get the gameId.');
            return;
        }
        gameData = getDataFromEncodedHash(encodedHash);
        gameId = gameData.gameId;
    }

    let ptn = getPtnFromFile(gameId);
    if (!ptn) {
        sendMessage(msg, 'No game with that id.');
    } else {
        sendMessage(msg, '<https://ptn.ninja/' + compressToEncodedURIComponent(ptn) + '>');
    }
}

function handleHistory(msg, page="1") {
    try {
        let historyData = getHistoryFromFile(parseInt(page));
        if (historyData) {
            sendMessage(msg, historyData);
        } else {
            sendMessage(msg, 'Not a valid page number');
        }
    } catch (err) {
        console.log(err);
    }
}

function handleHelp(msg) {
    sendMessage(msg, 'Use `!tak @opponent` to start a new game. You can use --option to specify any of the following:\
\nSize (optional, default 6): Valid values are 3 through 8.\
\nKomi (optional, default 0): A flat-score bonus for the second player. Valid values are any half-integer from -20.5 to 20.5.\
\nOpening (optional, default "swap"): Whether the first two flat moves play for your opponent. Valid values are "swap" and "no-swap"\
\nWhite (optional, boolean): Seats the message author as the White player.\
\nRandom (optional, boolean): Seats the message author randomly as White or Black.\
\n\nBy default the challenged player plays the white pieces.\
\n\nThe bot tracks games through the channel id.\
\nIf you want to run multiple games at once, please use different channels.\
\n\nHere are the rules for Tak: <https://ustak.org/play-beautiful-game-tak/>\
\nAlso, here\'s a PTN reference link: <https://ustak.org/portable-tak-notation/>\
\n\nExample commands:\
\n```!tak help\
\n!tak @opponent\
\n!tak @opponent --size 5 --komi 1 --opening no-swap --random\
\n!tak undo\
\n!tak end\
\n!tak link\
\n!tak link <gameId>\
\n!tak history\
\n!tak history <pageNumber>\
\n<while playing, any valid ply on its own line>```');
}

function handleRandom(msg, arg) {
    let rand = 1+Math.floor(Math.random()*arg);
    if (isNaN(rand)) return;
    sendMessage(msg, ""+rand);
}



// Main code

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    let message = msg.content.trim();
    if (message.length >= 4 && message.substring(0, 4).toLowerCase() == '!tak') {
        let args = message.substring(5).split(' ');
        args = args.filter(arg => arg && arg.length !== 0);
        let cmd = args[0];
        switch(cmd) {
            case 'help':
                handleHelp(msg);
                break;
            case 'undo':
                handleUndo(msg);
                break;
            case 'link':
                handleLink(msg, args[1]);
                break;
            case 'history':
                handleHistory(msg, args[1]);
                break;
            case 'end':
                handleEnd(msg);
                break;
            default:
                args.shift();
                let options = parser(args);
                handleNew(msg, options);
                break;
        }
    } else if (message.length >= 4 && message.substring(0,4).toLowerCase() == '!rng') {
        let args = message.substring(5).split(' ');
        args = args.filter(arg => arg && arg.length != 0);
        if (args.length != 1) return;
        handleRandom(msg, args[0]);
    } else {
        let args = message.split(' ');
        args = args.filter(arg => arg && arg.length !== 0);
        if (args.length != 1) return;
        if (!validPly(args[0])) return;
        handleMove(msg, args[0]);
    }
});

client.login(auth.token);
