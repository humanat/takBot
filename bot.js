const Discord = require('discord.js');
const fs = require('fs');
const lzutf8 = require('lzutf8');
const crypto = require('crypto');
const auth = require('./auth.json');
const parser = require('minimist');
const {TPStoCanvas, parseTPS, parseTheme} = require('./TPS-Ninja/src');
const {themes} = require('./TPS-Ninja/src/themes');
const {once} = require('events');
const {compressToEncodedURIComponent} = require('lz-string');
const {Permissions} = require('discord.js');

const client = new Discord.Client();
const defaultTheme = 'discord';



// Helper functions

function validPly(cmd) {
    return (cmd.match(/^(\d)?([CcSs])?([a-hA-H])([1-8])(([<>+-])([1-8]+)?(\*)?)?$/i)) ? true : false;
}

// Backward compatibility
function isOldVersion(msg) {
    return getLastFilename(msg) && !fs.existsSync(`data/${msg.channel.id}/meta/game.json`);
}

function getLastFilename(msg) {
    const dirname = `data/${msg.channel.id}/`;
    let files = fs.readdirSync(dirname).filter(file => file != 'meta');
    files.sort();
    return files && files.length ? dirname + files[files.length-1] : false;
}

// Backward compatibility
function getEncodedHashFromFile(msg) {
    const dirname = `data/${msg.channel.id}/`;
    try {
        return fs.readFileSync(getLastFilename(msg), 'utf8');
    } catch (err) {
        // On error we assume that the file doesn't exist
    }
}

async function getGameData(msg) {
    let dirname = 'data/' + msg.channel.id;
    let data;
    if (isOldVersion(msg)) {
        // Backward compatibility
        data = getDataFromEncodedHash(getEncodedHashFromFile(msg));
        data.player1Id = data.player1;
        data.player2Id = data.player2;
        Object.assign(data, await fetchPlayerNames(data));
        return data;
    } else {
        try {
            // Get meta info
            data = JSON.parse(fs.readFileSync(dirname + '/meta/game.json', 'utf8'));

            // Get the latest board state
            let filename = getLastFilename(msg);
            [data.tps, data.hl] = fs.readFileSync(filename, 'utf8').split('\n');
            let parsedTPS = parseTPS(data.tps);
            data.turnMarker = String(parsedTPS.player);
            return data;
        } catch (err) {
            // On error we assume that the file doesn't exist
        }
    }
}

function saveGameData(msg, { gameData, tps, ply }) {
    if (isOldVersion(msg)) {
        // Backward compatibility
        let encodedHash = encodeHashFromData({
            'player1': gameData.player1Id,
            'player2': gameData.player2Id,
            'tps': tps,
            'komi': gameData.komi,
            'gameId': gameData.gameId,
            'opening': gameData.opening
        });
        saveEncodedHashToFile(msg.channel, encodedHash);
    } else {
        const channelDir = `data/${msg.channel.id}/`;
        // Meta data
        if (gameData) {
            const metaDir = channelDir + 'meta/';
            try {
                fs.mkdirSync(metaDir, {recursive:true});
                fs.writeFileSync(metaDir + 'game.json', JSON.stringify(gameData));
            } catch (err) {
                console.error(err);
            }
        }

        // Board state
        let filename = Date.now() + crypto.randomBytes(2).toString('hex');
        if (20 - filename.length > 0) {
            for (let i = 0; i < 20-filename.length; i++) {
                filename = '0' + filename;
            }
        }
        if (ply) {
            tps += '\n' + ply;
        }
        try {
            fs.writeFileSync(channelDir + filename + '.tps', tps);
        } catch (err) {
            console.error(err);
        }
    }
}

// Backward compatibility
function saveEncodedHashToFile(channel, encodedHash) {
    let dirname = 'data/' + channel.id;
    try {
        fs.mkdirSync(dirname, {recursive:true});
    } catch (err) {
        console.error(err);
    }
    let filename = Date.now() + crypto.randomBytes(2).toString('hex');
    if (20 - filename.length > 0) {
        for (let i = 0; i < 20-filename.length; i++) {
            filename = '0' + filename;
        }
    }
    filename = 'data/' + channel.id + '/' + filename + '.data';
    try {
        fs.writeFileSync(filename, encodedHash);
    } catch (err) {
        console.error(err);
    }
}

function deleteLastTurn(msg, gameData) {
    try {
        fs.unlinkSync(getLastFilename(msg));
        if (gameData.gameId) {
            removeLastPlyFromPtnFile(gameData.gameId);
        }
    } catch (err) {
        console.error(err);
    }
}

function checkForOngoingGame(msg) {
    return fs.existsSync(`data/${msg.channel.id}/meta/game.json`) || getLastFilename(msg);
}

function cleanupFiles(msg, deleteChannel=false) {
    let dirname = 'data/' + msg.channel.id;
    try {
        let theme;
        if (!deleteChannel) theme = getTheme(msg);
        fs.rmdirSync(dirname, {recursive:true, force:true});
        if (!deleteChannel) setTheme(msg, theme, true);
        else msg.channel.delete();
    } catch (err) {
        console.error(err);
    }
}

// Backward compatibility
function getDataFromEncodedHash(encodedHash) {
    let gameHash = lzutf8.decompress(decodeURI(encodedHash.replace(/_/g, '/')), {'inputEncoding': 'Base64'}).split('___');
    let playersString = gameHash[0];
    let players = playersString.split('_');
    let tps = gameHash[1] || '';
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

// Backward compatibility
function encodeHashFromData(gameData) {
    let gameHash = gameData.player1 + '_' + gameData.player2
            + '___' + gameData.tps.replace(/\//g, '-').replace(/,/g, '_').replace(/ /g, '__')
            + '___' + gameData.komi
            + '___' + gameData.gameId
            + '___' + gameData.opening
    return encodeURI(lzutf8.compress(gameHash, {'outputEncoding': 'Base64'})).replace(/\//g, '_');
}

function tagDateTime() {
    const pad = (num) => {
        return (num < 9 ? '0' : '') + num;
    };
    const now = new Date();
    return (
        `[Date "${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}"]`+
        `[Time "${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}"]`
    );
};

function createPtnFile(gameData) {
    try {
        fs.mkdirSync('ptn', {recursive:true});
    } catch (err) {
        console.error(err);
    }

    let gameId = Date.now() + crypto.randomBytes(2).toString('hex');
    let filename = 'ptn/' + gameId + '.ptn';
    let data = tagDateTime()
        + `[Site "https://github.com/humanat/takBot"]`
        + `[Player1 "${gameData.player1}"]`
        + `[Player2 "${gameData.player2}"]`
        + `[Size "${gameData.size}"]`
        + `[Komi "${gameData.komi}"]`
        + `[Opening "${gameData.opening}"]`;
    if (gameData.initialTPS) {
        data = `[TPS "${gameData.initialTPS}"]` + data;
    }
    try {
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.error(err);
    }
    return gameId;
}

function deletePtnFile(gameId) {
    try {
        fs.unlinkSync(`ptn/${gameId}.ptn`);
    } catch (err) {
        console.error(err);
    }
    return gameId;
}

function addPlyToPtnFile(gameId, ply) {
    const filename = `ptn/${gameId}.ptn`;
    try {
        let data = fs.readFileSync(filename, 'utf8');
        data += ' ' + ply;
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.error(err);
    }
}

function removeLastPlyFromPtnFile(gameId) {
    let filename = `ptn/${gameId}.ptn`;
    try {
        let data = fs.readFileSync(filename, 'utf8');
        data = data.substr(0, data.lastIndexOf(' '));
        fs.writeFileSync(filename, data);
    } catch (err) {
        console.error(err);
    }
}

function getPtnFromFile(gameId) {
    let filename = `ptn/${gameId}.ptn`;
    try {
        return fs.readFileSync(filename, 'utf8');
    } catch (err) {
        if (!err.message.includes('no such file or directory')) {
            console.error(err);
        }
    }
}

function addToHistoryFile({gameId, player1, player2, komi, opening, result}) {
    let historyFilename = 'results.db';
    let ptnFilename = `ptn/${gameId}.ptn`;
    let resultString = `${gameId}, ${player1}, ${player2}, ${komi}, ${opening}, ${result}\n`;
    try {
        fs.appendFileSync(historyFilename, resultString);
        // Update PTN
        let data = fs.readFileSync(ptnFilename, 'utf8');
        let lastTag = data.indexOf("] ") + 1;
        data = data.substr(0, lastTag)
            + tagDateTime()
            + `[Result "${result}"]`
            + data.substr(lastTag)
            + ' ' + result;
        fs.writeFileSync(ptnFilename, data);
    } catch (err) {
        console.error(err);
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
        while (historyArray[historyArray.length-1] == '') { historyArray.pop(); }
        let numPages = Math.ceil(historyArray.length/gamesPerPage);
        if (page > numPages) { return; }
        historyArray = historyArray.reverse();
        historyArray = historyArray.slice((page-1)*gamesPerPage, page*gamesPerPage);
        history = `Page ${page} of ${numPages}\n\n${header}\n` + historyArray.join('\n');
        return history;
    } catch (err) {
        console.error(err);
    }
}



// Getter functions for reading from Discord

async function getGameMessages(msg) {
    let messages = await msg.channel.messages.fetch();
    return messages.filter(m => m.author.id === client.user.id).filter(m => m.attachments.array().length);
}

async function fetchPlayerNames(gameData) {
    const result = {};
    try {
        await Promise.all([
            client.users.fetch(gameData.player1).then(
                (player1) => { result.player1 = player1.username; }
            ),
            client.users.fetch(gameData.player2).then(
                (player2) => { result.player2 = player2.username; }
            )
        ]);
    } catch (err) {
        console.error(err);
    }
    return result;
}



// Functions to send to Discord

async function sendPngToDiscord(channel, canvas, messageComment) {
    try {
        fs.mkdirSync('images', {recursive:true});
    } catch (err) {
        console.error(err);
    }
    let filename = 'images/' + channel.id + '.png';
    let out = fs.createWriteStream(filename);
    let stream = canvas.pngStream();
    stream.pipe(out);
    await once(out, 'finish');
    try {
        await channel.send(messageComment, {
            files: [{
                attachment: filename,
                name: filename
            }]
        });
    } catch (err) {
        console.error(err);
    }
    fs.unlink(filename, (err) => {
        if (err) console.error(err);
    });
}

async function sendMessage(msg, content) {
    try {
        if (typeof content == "string" && content.length <= 2000) {
            await msg.channel.send(content);
        } else {
            await msg.channel.send('I tried to send a message but it was too long 😢');
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteLastGameMessage(msg) {
    let messages = await getGameMessages(msg);
    if (messages.array().length >= 0) {
        messages.first().delete();
    }
}



// Major handler methods

function drawBoard(gameData, theme, ply) {
    let options = {
        ...gameData,
        theme,
        padding: false,
        bgAlpha: 0
    }
    if (ply) {
        options.ply = ply;
    }
    return TPStoCanvas(options);
}

async function handleNew(msg, options) {
    if (msg.mentions.users.array().length != 1) {
        sendMessage(msg, 'I didn\'t understand. See `!tak help` for example commands.');
    } else if (checkForOngoingGame(msg)) {
        sendMessage(msg, 'There\'s a game in progress! Use `!tak end` if you\'re sure no one is using this channel.');
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

        let tps = options.tps || options.size || 6;
        let tpsParsed;
        let size;
        if (options.tps) {
            // TPS
            tps += " " + options._[0] + " " + options._[1];
            tpsParsed = parseTPS(tps);
            if (tpsParsed.error) {
                sendMessage(msg, tpsParsed.error);
                return;
            }
            size = tpsParsed.size;
        } else {
            // Size
            size = tps;
            if (size < 3 || size > 8) {
                sendMessage(msg, 'Invalid board size.');
                return;
            }
        }

        // Komi
        let komi = options.komi || 0;
        if (komi < -20.5 || komi > 20.5) {
            sendMessage(msg, 'Invalid komi.');
            return;
        }

        // Opening
        let opening = options.opening || 'swap';
        if (opening != 'swap' && opening != 'no-swap') {
            sendMessage(msg, 'Invalid opening.');
            return;
        }

        // Theme
        let theme;
        if (options.theme) {
            try {
                theme = parseTheme(options.theme);
            } catch(err) {
                sendMessage(msg, 'Invalid theme');
                return;
            }
        } else {
            theme = getTheme(msg);
        }

        // Create game data
        const gameData = {
            player1Id: player1.id,
            player2Id: player2.id,
            player1: player1.username,
            player2: player2.username,
            size,
            komi,
            opening
        };
        let nextPlayer = player1.id;
        if (options.tps) {
            gameData.initialTPS = tps;
            if (tpsParsed.player != 1) nextPlayer = player2.id;
        }
        const gameId = createPtnFile(gameData);
        gameData.gameId = gameId;

        let useNewChannel = Boolean(options.newChannel);

        let channel = msg.channel;
        if (useNewChannel) {
            try {
                channel = await msg.guild.channels.create(`🆚${gameData.player1}-vs-${gameData.player2}`, {
                    parent: msg.channel.parent,
                    // permissionOverwrites: [{
                        //     id: player1.id,
                        //     allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
                    // },{
                        //     id: player2.id,
                        //     allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
                    // }]
                });
                sendMessage(msg, `Here you go!\n<#${channel.id}>`);
            } catch (error) {
                console.error(error);
                sendMessage(msg, 'I wasn\'t able to create a new channel.');
                return;
            }
        } else if (!msg.channel.name.startsWith('🆚')) {
            msg.channel.setName('🆚' + msg.channel.name);
        }

        let canvas;
        try {
            canvas = drawBoard({ ...gameData, tps }, theme);
        } catch (error) {
            console.log(error);
            sendMessage(msg, 'Something went wrong when I tried to draw the board.');
            return;
        }

        saveGameData({ channel }, { tps: canvas.id, gameData });
        if (options.theme) {
            setTheme({ channel }, options.theme, true);
        }
        let messageComment = 'Your turn '+canvas.linenum+', <@'+nextPlayer+'>.\n'+
            'Type a valid move in PTN to play.\n(<https://ustak.org/portable-tak-notation/>)';
        sendPngToDiscord(channel, canvas, messageComment);
    }
}

async function handleEnd(msg) {
    if (checkForOngoingGame(msg)) {
        const gameData = await getGameData(msg);
        if (gameData && gameData.gameId) {
            cleanupFiles(msg);
            deletePtnFile(gameData.gameId);
            msg.channel.setName(msg.channel.name.replace('🆚', ''));
            sendMessage(msg, 'Ongoing game in this channel has been removed.');
        }
    } else {
        sendMessage(msg, 'There is no ongoing game in this channel.');
    }
}

async function handleDelete(msg) {
    if (checkForOngoingGame(msg)) {
        sendMessage(msg, 'There is an ongoing game in this channel! If you\'re sure you about this, please say `!tak end` and try again.');
    } else {
        cleanupFiles(msg, true);
    }
}

async function handleMove(msg, ply) {
    let gameData = await getGameData(msg);
    if (!gameData) return;

    if (msg.author.id != gameData.player1Id && msg.author.id != gameData.player2Id) {
        return;
    }

    if ((gameData.turnMarker === '1' && msg.author.id != gameData.player1Id)
            || (gameData.turnMarker === '2' && msg.author.id != gameData.player2Id)) {
        sendMessage(msg, 'You are not the active player.');
        return;
    }

    let canvas;
    try {
        canvas = drawBoard(gameData, getTheme(msg), ply);
    } catch (err) {
        if (!err.message.includes('Invalid')) {
            console.error(err);
        }
        sendMessage(msg, 'Invalid move.');
        return;
    }

    if (gameData.gameId) {
        addPlyToPtnFile(gameData.gameId, ply);
    }

    let nextPlayer = gameData.player1Id;
    if (gameData.turnMarker === '1') nextPlayer = gameData.player2Id;

    if (!canvas.isGameEnd) {
        // Game is still in progress
        if (isOldVersion(msg)) {
            // Backward compatibility
            saveGameData(msg, { tps: canvas.id, gameData });
        } else {
            saveGameData(msg, { tps: canvas.id, ply });
        }
        await sendPngToDiscord(msg.channel, canvas, 'Your turn '+canvas.linenum+', <@'+nextPlayer+'>.');
    } else {
        // Game is over
        const result = canvas.id;
        cleanupFiles(msg);
        if (gameData.gameId) {
            addToHistoryFile({
                'gameId': gameData.gameId,
                'player1': gameData.player1,
                'player2': gameData.player2,
                'komi': gameData.komi,
                'opening': gameData.opening,
                'result': canvas.id
            });
        }
        await msg.channel.setName(msg.channel.name.replace('🆚', ''));
        await sendPngToDiscord(msg.channel, canvas, `GG <@${nextPlayer}>! Game Ended ${result}`);
        await sendMessage(msg, 'Here\'s a link to the completed game:');
        handleLink(msg, gameData.gameId);
    }
}

async function handleUndo(msg) {
    let gameData = await getGameData(msg);
    if (!gameData) {
        sendMessage(msg, 'You cannot undo a completed game.');
        return;
    }

    if (msg.author.id != gameData.player1Id && msg.author.id != gameData.player2Id) {
        return;
    }

    if ((gameData.turnMarker === '1' && msg.author.id != gameData.player2Id)
            || (gameData.turnMarker === '2' && msg.author.id != gameData.player1Id)) {
        sendMessage(msg, 'You cannot undo a move that is not your own.');
        return;
    }

    await deleteLastGameMessage(msg);
    deleteLastTurn(msg, gameData);
    sendMessage(msg, 'Undo complete.');
}

async function handleLink(msg, gameId) {
    if (!gameId) {
        let gameData = await getGameData(msg);
        if (!gameData) {
            sendMessage(msg, 'You must use the game ID to get a link for a completed game. See `!tak history` to get the game ID.');
            return;
        }
        gameId = gameData.gameId;
    }

    let ptn = getPtnFromFile(gameId);
    if (!ptn) {
        sendMessage(msg, 'I couldn\'t find a game with that ID.');
    } else {
        sendMessage(msg, '<https://ptn.ninja/' + compressToEncodedURIComponent(ptn) + '>');
    }
}

function handleHistory(msg, page='1') {
    try {
        let historyData = getHistoryFromFile(parseInt(page));
        if (historyData) {
            sendMessage(msg, historyData);
        } else {
            sendMessage(msg, 'Not a valid page number');
        }
    } catch (err) {
        console.error(err);
    }
}

function getTheme(msg) {
    try {
        return fs.readFileSync(`data/${msg.channel.id}/meta/theme`, 'utf8') || defaultTheme;
    } catch (err) {
        if (!err.message.includes('no such file or directory')) {
            console.error(err);
        }
    }
    return defaultTheme;
}

async function setTheme(msg, theme, silent = false) {
    try {
        fs.mkdirSync(`data/${msg.channel.id}/meta`, {recursive:true});
        fs.writeFileSync(`data/${msg.channel.id}/meta/theme`, theme);
        if (!silent) {
            if (isOldVersion(msg)) {
                // Backward compatibility
                return sendMessage(msg, 'Theme set.');
            } else {
                // Re-create current board
                const gameData = await getGameData(msg);
                await deleteLastGameMessage(msg);
                let canvas;
                canvas = drawBoard(gameData, theme);
                let nextPlayer = gameData.player1Id;
                if (gameData.turnMarker === '1') nextPlayer = gameData.player2Id;
                return sendPngToDiscord(msg.channel, canvas, 'Your turn '+canvas.linenum+', <@'+nextPlayer+'>.');
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function handleTheme(msg, theme) {
    if (theme) {
        try {
            parseTheme(theme);
        } catch(err) {
            sendMessage(msg, 'Invalid theme');
            return;
        }
        setTheme(msg, theme);
    } else {
        theme = getTheme(msg);

        sendMessage(msg, theme[0] === '{' ? `\`\`\`\n${theme}\n\`\`\`` : `\`${theme}\``);
    }
}

function handleHelp(msg) {
    let readme = fs.readFileSync('README.md', 'utf8');
    sendMessage(msg, readme.substr(readme.indexOf('\n')+1));
}

function handleRandom(msg, arg) {
    let rand = 1+Math.floor(Math.random()*arg);
    if (isNaN(rand)) return;
    sendMessage(msg, ''+rand);
}



// Main code

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    let message = msg.content.trim();
    if (message.length >= 4 && message.substring(0, 4).toLowerCase() === '!tak') {
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
            case 'theme':
                handleTheme(msg, args.slice(1).join(' '));
                break;
            case 'themes':
                sendMessage(msg, themes.map(t => t.id).join('\n'));
                break;
            case 'end':
                handleEnd(msg);
                break;
            case 'delete':
                handleDelete(msg);
                break;
            default:
                args.shift();
                let options = parser(args);
                handleNew(msg, options);
                break;
        }
    } else if (message.length >= 4 && message.substring(0,4).toLowerCase() === '!rng') {
        let args = message.substring(5).split(' ');
        args = args.filter(arg => arg && arg.length);
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
