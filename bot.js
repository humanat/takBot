const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const auth = require('./auth.json');
const parser = require('minimist');
const {parseTPS, parseTheme} = require('./TPS-Ninja/src');
const {themes} = require('./TPS-Ninja/src/themes');
const {compressToEncodedURIComponent} = require('lz-string');
const {Permissions} = require('discord.js');
const timestring = require('timestring');
const chrono = require('chrono-node');

const {cleanupFiles} = require('./util');

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
    ],
});




// Slash commands

client.commands = new Discord.Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Discord.Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
    
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction, client);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});



// Major handler methods

async function handleResign(msg) {
    let gameData = getGameData(msg);

    if (gameData) {
        let result;
        if (msg.author.id === gameData.player1Id) {
            result = "0-1";
        } else if (msg.author.id === gameData.player2Id) {
            result = "1-0";
        } else {
            return sendMessage(msg, "You are not an active player.");
        };

        let nextPlayer = gameData.player1Id;
        if (gameData.turnMarker === '1') nextPlayer = gameData.player2Id;
        addPlyToPtnFile(gameData.gameId, result);
        cleanupFiles(msg);
        if (gameData.gameId) {
            addToHistoryFile({
                'gameId': gameData.gameId,
                'player1': gameData.player1,
                'player2': gameData.player2,
                'komi': gameData.komi,
                'opening': gameData.opening,
                'result': result
            });
        }
        await sendMessage(msg, `GG <@${nextPlayer}>! Game Ended ${result}`);
        await sendMessage(msg, `Here's a link to the completed game:\nID: ${gameData.gameId}`);
        await handleLink(msg, gameData.gameId);
        clearReminderTimer(msg);
        setDeleteTimer(msg);
        return renameChannel(msg, false);
    } else {
        return sendMessage(msg, 'There is no ongoing game in this channel.');
    }
}

async function handleEnd(msg) {
    if (isGameOngoing(msg)) {
        let gameData = getGameData(msg);
        if (gameData.hl) {
            await sendMessage(msg, 'Here\'s a link to the game:');
            await handleLink(msg);
        }
        cleanupFiles(msg);
        deletePtnFile(gameData);
        clearReminderTimer(msg);
        setDeleteTimer(msg);
        await sendMessage(msg, 'Ongoing game in this channel has been removed.');
        return renameChannel(msg, false);
    } else {
        return sendMessage(msg, 'There is no ongoing game in this channel.');
    }
}

async function handleDelete(msg) {
    if (isGameOngoing(msg)) {
        return sendMessage(msg, 'There is an ongoing game in this channel! If you\'re sure you about this, please say `!tak end` and try again.');
    } else {
        if (!isGameChannel(msg)) {
            return sendMessage(msg, 'I can\'t delete this channel.');
        } else {
            const gameData = getGameData(msg);
            if(!isPlayer(msg, gameData)) {
                return sendMessage(msg, 'Only the previous players may delete the channel.');
            } else {
                try {
                    await sendMessage(msg, 'Deleting channel. Please be patient, as this sometimes takes a while.');
                    return msg.channel.delete();
                } catch (err) {
                    console.error(err);
                    return sendMessage(msg, 'I wasn\'t able to delete the channel.');
                }
            }
        }
    }
}

async function handleMove(msg, ply) {
    if (!isGameOngoing(msg)) return;

    let gameData = getGameData(msg);
    if (!gameData) return;

    if (!isPlayer(msg, gameData)) {
        return;
    }

    if ((gameData.turnMarker === '1' && msg.author.id != gameData.player1Id)
            || (gameData.turnMarker === '2' && msg.author.id != gameData.player2Id)) {
        return sendMessage(msg, 'You are not the active player.');
    }

    let canvas;
    try {
        ply = ply.replace('’', '\'').replace('”', '"');
        canvas = drawBoard(gameData, getTheme(msg), ply);
    } catch (err) {
        if (!/^Invalid|stones remaining$/.test(err.message)) {
            console.error(err);
        }
        return sendMessage(msg, 'Invalid move.');
    }

    if (gameData.gameId) {
        addPlyToPtnFile(gameData.gameId, ply);
    }

    let nextPlayer = gameData.player1Id;
    if (gameData.turnMarker === '1') nextPlayer = gameData.player2Id;

    if (!canvas.isGameEnd) {
        // Game is still in progress
        saveGameData(msg, { tps: canvas.id, ply });
        if (!msg.channel.name.includes('🆚')) {
            renameChannel(msg, true);
        }
        const message = getTurnMessage(gameData, canvas, ply);
        await sendPngToDiscord(msg, canvas, message);

        clearReminderTimer(msg);
        setReminderTimer(msg, gameData, canvas);
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
                'result': result
            });
        }
        await sendPngToDiscord(msg, canvas, `${ply} | GG <@${nextPlayer}>! Game Ended ${result}`);
        await sendMessage(msg, `Here's a link to the completed game:\nID: ${gameData.gameId}`);
        await handleLink(msg, gameData.gameId);
        clearReminderTimer(msg);
        setDeleteTimer(msg);
        return renameChannel(msg, false);
    }
}

async function handleUndo(msg) {
    let gameData = getGameData(msg);
    if (!gameData) {
        return sendMessage(msg, 'This isn\'t a game channel.');
    }

    if (!gameData.hl) {
        return sendMessage(msg, 'There\'s nothing to undo.');
    }

    if (!isGameOngoing(msg)) {
        return sendMessage(msg, 'The game is over, but you can start a new game using the --tps flag!');
    }

    if (!isPlayer(msg, gameData)) {
        return;
    }

    if (
        (gameData.turnMarker === '1' && msg.author.id != gameData.player2Id) ||
        (gameData.turnMarker === '2' && msg.author.id != gameData.player1Id)
    ) {
        return sendMessage(msg, 'You cannot undo a move that is not your own.');
    }

    deleteLastTurn(msg, gameData);
    gameData = getGameData(msg);
    const canvas = drawBoard(gameData, getTheme(msg));
    const message = 'Undo complete!\n' + getTurnMessage(gameData, canvas);

    clearReminderTimer(msg);
    setReminderTimer(msg, gameData, canvas);

    return sendPngToDiscord(msg, canvas, message);
}

async function handleRedraw(msg) {
    if (!isGameOngoing(msg)) {
        return sendMessage(msg, 'I couldn\'t find an ongoing game in this channel.');
    }
    const gameData = getGameData(msg);
    const canvas = drawBoard(gameData, getTheme(msg));
    const message = getTurnMessage(gameData, canvas);
    return sendPngToDiscord(msg, canvas, message);
}

async function handleRematch(msg) {
    const gameData = getGameData(msg);
    if (!gameData) {
        return sendMessage(msg, 'I couldn\'t find a previous game in this channel.');
    } else if (gameData.tps) {
        return sendMessage(msg, 'There\'s still a game in progress!');
    } else if (!isPlayer(msg, gameData)) {
        return sendMessage(msg, 'Only the previous players can rematch.');
    }

    // Swap players
    [gameData.player1, gameData.player1Id, gameData.player2, gameData.player2Id] =
        [gameData.player2, gameData.player2Id, gameData.player1, gameData.player1Id];

    // Generate new game ID
    const gameId = createPtnFile(gameData);
    gameData.gameId = gameId;

    let nextPlayer = gameData.player1Id;
    if (gameData.initialTPS) {
        let tpsParsed = parseTPS(gameData.initialTPS);
        if (tpsParsed.player != 1) {
            nextPlayer = gameData.player2Id;
        }
    }

    msg.channel.setName(`${gameData.player1}-🆚-${gameData.player2}`);
    let canvas;
    try {
        canvas = drawBoard({ ...gameData, tps: gameData.initialTPS || gameData.size }, getTheme(msg));
    } catch (err) {
        console.error(err);
        return sendMessage(msg, 'Something went wrong when I tried to draw the board.');
    }

    saveGameData(msg, { tps: canvas.id, gameData });
    const message = getTurnMessage(gameData, canvas);
    sendPngToDiscord(msg, canvas, message);

    clearDeleteTimer(msg);
    setReminderTimer(msg, gameData, canvas);
}

function handleHistory(msg, page='1') {
    try {
        let historyData = getHistoryFromFile(parseInt(page));
        if (historyData) {
            return sendMessage(msg, '```\n' + historyData + '\n```');
        } else {
            return sendMessage(msg, 'Not a valid page number');
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleTheme(msg, theme) {
    if (!isGameChannel(msg)) {
        return sendMessage(msg, 'This isn\'t a game channel.');
    } else if (theme) {
        const gameData = getGameData(msg);
        const isOngoing = isGameOngoing(msg);
        if (!isPlayer(msg, gameData)) {
            return sendMessage(msg, `Only the ${isOngoing ? 'current' : 'previous'} players may change the theme.`);
        }

        try {
            parseTheme(theme);
        } catch(err) {
            return sendMessage(msg, 'Invalid theme');
        }
        if (setTheme(msg, theme)) {
            if (!isGameOngoing(msg)) {
                return sendMessage(msg, 'Theme set.');
            } else {
                handleRedraw(msg);
            }
        }
    } else {
        theme = getTheme(msg);

        return sendMessage(msg, theme[0] === '{' ? `\`\`\`\n${theme}\n\`\`\`` : `\`${theme}\``);
    }
}

function handleHelp(msg) {
    let help = fs.readFileSync('USAGE.md', 'utf8');
    help = help.substring(help.indexOf('\n')+1);
    return sendMessage(msg, help);
}

function handleRandom(msg, arg) {
    let rand = 1+Math.floor(Math.random()*arg);
    if (isNaN(rand)) return;
    return sendMessage(msg, ''+rand);
}

function handleReminder(msg, arg) {
    try {
        let time = timestring(arg);
        let msUntilReminder = time*1000;
        sendMessage(msg, 'OK, I will ping you in this channel after ' + time + ' seconds.');
        setTimeout(sendMessage, msUntilReminder, msg, 'Hey <@'+msg.author.id+'>, you wanted me to remind you about this channel.');
    } catch(err) {
        sendMessage(msg, 'I did not understand how long you wanted me to wait before reminding you.');
    }
}

function handleDate(msg, arg) {
    try {
        let time = Math.round(Date.parse(chrono.parseDate(arg))/1000);
        sendMessage(msg, '<t:'+time+'>');
    } catch(err) {
        sendMessage(msg, 'I\'m sorry, I couldn\'t convert that date.');
    }
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
                return handleHelp(msg);
            case 'undo':
                return handleUndo(msg);
            case 'link':
                return handleLink(msg, args[1]);
            case 'redraw':
                return handleRedraw(msg);
            case 'rematch':
                return handleRematch(msg);
            case 'history':
                return handleHistory(msg, args[1]);
            case 'theme':
                return handleTheme(msg, args.slice(1).join(' '));
            case 'themes':
                return sendMessage(msg, themes.map(t => t.id).join('\n'));
            case 'resign':
                return handleResign(msg);
            case 'end':
                return handleEnd(msg);
            case 'delete':
                return handleDelete(msg);
            case 'reminder':
                return handleReminder(msg, args[1]);
            case 'date':
                return handleDate(msg, message.substring(10));
            default:
                args.shift();
                let options = parser(
                  args.map(arg => arg.toLowerCase().replace(/[—–]+/g, "--"))
                );
                return handleNew(msg, options);
        }
    } else if (message.length >= 4 && message.substring(0,4).toLowerCase() === '!rng') {
        let args = message.substring(5).split(' ');
        args = args.filter(arg => arg && arg.length);
        if (args.length != 1) return;
        return handleRandom(msg, args[0]);
    } else {
        let args = message.split(' ');
        args = args.filter(arg => arg && arg.length !== 0);
        if (args.length != 1) return;
        if (!validPly(args[0])) return;
        return handleMove(msg, args[0]);
    }
});

client.on('channelDelete', function(channel){
    return cleanupFiles({ channel }, true);
});

client.login(auth.token);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
