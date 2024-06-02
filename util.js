const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {TPStoCanvas, parseTPS} = require('./TPS-Ninja/src');


// Persisting variables

const defaultTheme = 'discord';
let deleteTimers = [];
let reminderTimers = [];

module.exports = {

    // Helper functions

    validPly(cmd) {
        return /^(\d)?([CcSs])?([a-hA-H])([1-8])(([<>+-])([1-8]+)?\*?)?['"’”?!]*$/i.test(cmd);
    },

    getLastFilename(msg) {
        let dirname = path.join(__dirname, 'data', msg.channelId, 'tps');
        if (!fs.existsSync(dirname)) {
            return false;
        }
        let files = fs.readdirSync(dirname);
        files.sort();
        return files && files.length ? dirname + files[files.length-1] : false;
    },

    getGameData(msg) {
        const channelDir = path.join(__dirname, 'data', msg.channelId);
        const metaDir = path.join(channelDir, 'meta');
        const tpsDir = path.join(channelDir, 'tps');

        try {
            // Get meta info
            let data = JSON.parse(fs.readFileSync(path.join(metaDir, 'game.json'), 'utf8'));

            // Get the latest board state
            if (fs.existsSync(tpsDir)) {
                let filename = getLastFilename(msg);
                [data.tps, data.hl] = fs.readFileSync(filename, 'utf8').split('\n');
                let parsedTPS = parseTPS(data.tps);
                data.turnMarker = String(parsedTPS.player);
                data.moveNumber = Number(parsedTPS.linenum);
            }
            return data;
        } catch (err) {
            // On error we assume that the file doesn't exist
        }
    },

    isPlayer(msg, gameData) {
        return msg.author.id == gameData.player1Id || msg.author.id == gameData.player2Id;
    },

    saveGameData(msg, { gameData, tps, ply }) {
        const channelDir = path.join(__dirname, 'data', msg.channelId);
        const metaDir = path.join(channelDir, 'meta');
        const tpsDir = path.join(channelDir, 'tps');

        // Meta data
        if (gameData) {
            try {
                fs.mkdirSync(metaDir, {recursive:true});
                fs.writeFileSync(path.join(metaDir, 'game.json'), JSON.stringify(gameData));
            } catch (err) {
                console.error(err);
            }
        }

        // Board state
        let filename = Date.now() + crypto.randomBytes(2).toString('hex');
        while (filename.length < 19) {
            filename = '0' + filename;
        }
        if (ply) {
            tps += '\n' + ply;
        }
        try {
            fs.mkdirSync(tpsDir, {recursive:true});
            fs.writeFileSync(path.join(tpsDir, filename + '.tps'), tps);
        } catch (err) {
            console.error(err);
        }
    },

    drawBoard(gameData, theme, ply) {
        let moveNumber = gameData.moveNumber;
        if (!ply && gameData.hl && gameData.turnMarker === '1') {
            moveNumber -= 1;
        }
        let options = {
            ...gameData,
            moveNumber,
            theme,
            bgAlpha: 0,
            padding: false
        }
        if (ply) {
            options.ply = ply;
        }
        let canvas = TPStoCanvas(options);
        console.log(moveNumber, gameData.turnMarker);
        canvas.filename = `${moveNumber}${gameData.turnMarker === '1' ? 'w' : 'b'}.png`;
        canvas.komi = gameData.komi;
        return canvas;
    },

    getTheme(msg) {
        const metaDir = path.join(__dirname, 'data', msg.channelId, 'meta');
        try {
            return fs.readFileSync(path.join(metaDir, 'theme'), 'utf8') || defaultTheme;
        } catch (err) {
            if (!err.message.includes('no such file or directory')) {
                console.error(err);
            }
        }
        return defaultTheme;
    },
    
    setTheme(msg, theme) {
        const metaDir = path.join(__dirname, 'data', msg.channelId, 'meta');
        try {
            fs.mkdirSync(metaDir, {recursive:true});
            fs.writeFileSync(path.join(metaDir, 'theme'), theme);
            return true;
        } catch (err) {
            sendMessage(msg, 'Something went wrong when I tried to save the theme.');
            console.error(err);
            return false;
        }
    },

    getTurnMessage(gameData, canvas, ply=gameData.hl) {
        const nextPlayer = gameData[`player${canvas.player}Id`];
        let message = `Your turn ${canvas.linenum}, <@${nextPlayer}>.`;
        if (ply) {
            const lastPlayer = canvas.player == 1 ? 2 : 1;
            message = ply + ' | ' + message;
            if (/''|"/.test(ply)) {
                message += '\n*' + gameData[`player${lastPlayer}`];
                message += ply.includes('?') ? ' thinks that might be' : ' is pretty sure that\'s';
                message += ' Tinuë.*';
            } else if (/'/.test(ply)) {
                message += '\n*Tak!*';
            }
        } else {
            message += '\nType a valid move in PTN to play.\n(<https://ustak.org/portable-tak-notation/>)'
        }
        return message;
    },

    getReminderMessage(gameData, canvas) {
        const nextPlayer = gameData[`player${canvas.player}Id`];
        return `It's been a while since your last move. Please take your turn soon, <@${nextPlayer}>.`;
    },

    deleteLastTurn(msg, gameData) {
        try {
            fs.unlinkSync(getLastFilename(msg));
            if (gameData.gameId) {
                removeLastPlyFromPtnFile(gameData.gameId);
            }
        } catch (err) {
            console.error(err);
        }
    },
    
    renameChannel(msg, inProgress) {
        return msg.channel.setName(
            inProgress
                ? msg.channel.name.replace('-vs-', '-🆚-')
                : msg.channel.name.replace('-🆚-', '-vs-')
        ).catch(err => console.error(err));
    },

    isGameChannel(msg) {
        return fs.existsSync(path.join(__dirname, 'data', msg.channelId, 'meta', 'game.json'));
    },

    isGameOngoing(msg) {
        return fs.existsSync(path.join(__dirname, 'data', msg.channelId, 'tps'));
    },

    cleanupFiles(msg, channelDeleted=false) {
        const channelDir = path.join(__dirname, 'data', msg.channelId);
        try {
            if (channelDeleted) {
                fs.rmSync(channelDir, {recursive:true, force:true});
            } else {
                if (!fs.existsSync(channelDir)) {
                    return false;
                } else {
                    return fs.rmSync(path.join(channelDir, 'tps'), {recursive:true, force:true});
                }
            }
        } catch (err) {
            console.error(err);
        }
    },

    tagDateTime() {
        const pad = (num) => {
            return (num < 9 ? '0' : '') + num;
        };
        const now = new Date();
        return (
            `[Date "${now.getUTCFullYear()}.${pad(now.getUTCMonth()+1)}.${pad(now.getUTCDate())}"]`+
            `[Time "${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}"]`
        );
    },

    createPtnFile(gameData) {
        const ptnDir = path.join(__dirname, 'ptn');
        try {
            fs.mkdirSync(ptnDir, {recursive:true});
        } catch (err) {
            console.error(err);
        }

        let gameId = Date.now() + crypto.randomBytes(2).toString('hex');
        let filePath = path.join(ptnDir, `${gameId}.ptn`);
        let data = module.exports.tagDateTime()
            + `[Site "https://github.com/humanat/takBot"]`
            + `[Player1 "${gameData.player1}"]`
            + `[Player2 "${gameData.player2}"]`
            + `[Size "${gameData.size}"]`
        if (gameData.komi) {
            data += `[Komi "${gameData.komi}"]`;
        }
        if (gameData.opening != 'swap') {
            data += `[Opening "${gameData.opening}"]`;
        }
        if (gameData.initialTPS) {
            data = `[TPS "${gameData.initialTPS}"]` + data;
        }
        try {
            fs.writeFileSync(filePath, data);
        } catch (err) {
            console.error(err);
        }
        return gameId;
    },

    deletePtnFile(gameData) {
        if (!gameData || !gameData.gameId) {
            return false;
        }
        try {
            fs.unlinkSync(path.join(__dirname, 'ptn', `${gameData.gameId}.ptn`));
        } catch (err) {
            console.error(err);
        }
        return true;
    },

    addPlyToPtnFile(gameId, ply) {
        const filePath = path.join(__dirname, 'ptn', `${gameId}.ptn`);
        try {
            let data = fs.readFileSync(filePath, 'utf8');
            data += ' ' + ply;
            fs.writeFileSync(filePath, data);
        } catch (err) {
            console.error(err);
        }
    },

    removeLastPlyFromPtnFile(gameId) {
        let filePath = path.join(__dirname, 'ptn', `${gameId}.ptn`);
        try {
            let data = fs.readFileSync(filePath, 'utf8');
            data = data.substring(0, data.lastIndexOf(' '));
            fs.writeFileSync(filePath, data);
        } catch (err) {
            console.error(err);
        }
    },

    getPtnFromFile(gameId) {
        let filePath = path.join(__dirname, 'ptn', `${gameId}.ptn`);
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            if (!err.message.includes('no such file or directory')) {
                console.error(err);
            }
        }
    },

    addToHistoryFile({gameId, player1, player2, komi, opening, result}) {
        let historyFilename = path.join(__dirname, 'results.db');
        let ptnFilename = path.join(__dirname, 'ptn', `${gameId}.ptn`);
        let resultString = `${gameId}, ${player1}, ${player2}, ${komi}, ${opening}, ${result}\n`;
        try {
            fs.appendFileSync(historyFilename, resultString);
            // Update PTN
            let data = fs.readFileSync(ptnFilename, 'utf8');
            let lastTag = data.indexOf('] ') + 1;
            data = data.substring(0, lastTag)
                + tagDateTime()
                + `[Result "${result}"]`
                + data.substring(lastTag)
                + ' ' + result;
            fs.writeFileSync(ptnFilename, data);
        } catch (err) {
            console.error(err);
        }
    },

    getHistoryFromFile(page) {
        try {
            if (isNaN(page) || page < 1) { return; }
            let filename = path.join(__dirname, 'results.db');
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
    },

    async setDeleteTimer(msg) {
        await sendMessage(msg, 'This channel will self destruct in approximately 24 hours unless a new game is started.');
        let timerId = setTimeout(handleDelete, 86400000, msg);
        deleteTimers[msg.channelId] = timerId;
    },

    async clearDeleteTimer(msg) {
        let timerId = deleteTimers[msg.channelId];
        if (timerId) {
            clearTimeout(timerId);
            deleteTimers.splice(deleteTimers.indexOf(timerId), 1);
        }
    },

    async setReminderTimer(msg, gameData, canvas) {
        let message = getReminderMessage(gameData, canvas);
        let timerId = setInterval(sendMessage, 86400000, msg, message);
        reminderTimers[msg.channelId] = timerId;
    },

    async clearReminderTimer(msg) {
        let timerId = reminderTimers[msg.channelId];
        if (timerId) {
            clearInterval(timerId);
            reminderTimers.splice(reminderTimers.indexOf(timerId), 1);
        }
    },



    // Functions to send to Discord

    async sendPngToDiscord(msg, canvas, message) {
        const attachment = new Discord.AttachmentBuilder(
            canvas.toBuffer(),
            {
                name: canvas.filename,
                description: `${canvas.id} ${canvas.komi}`
            },
        );

        try {
            await msg.channel.send(message, {
                files: [attachment]
            });
        } catch (err) {
            console.error(err);
        }
    },

    async sendMessage(msg, content) {
        try {
            if (typeof content == 'string' && content.length <= 2000) {
                await msg.channel.send(content);
            } else {
                await msg.channel.send('I wanted to send a message but it was too long 😢');
            }
        } catch (err) {
            console.error(err);
        }
    }

}
