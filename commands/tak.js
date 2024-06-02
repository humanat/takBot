const {ChannelType, SlashCommandBuilder} = require('discord.js');
const {parseTPS, parseTheme} = require('../TPS-Ninja/src');
const {
    clearDeleteTimer,
    createPtnFile,
    drawBoard,
    getTheme,
    getTurnMessage,
    isGameChannel,
    isGameOngoing,
    saveGameData,
    sendPngToDiscord,
    setTheme,
} = require('../util');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tak')
		.setDescription('Begins a game of Tak against the specified opponent.')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Your opponent')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('Board size')
                .setMinValue(3)
                .setMaxValue(8)
        )
        .addNumberOption(option =>
            option.setName('komi')
                .setDescription('Komi')
                .setMinValue(-4.5)
                .setMaxValue(4.5)
        )
        .addStringOption(option =>
            option.setName('tps')
                .setDescription('Initial TPS')
        )
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('Theme name or JSON')
        )
        .addStringOption(option =>
            option.setName('opening')
                .setDescription('Opening variation')
                .addChoices(
                    { name: 'Swap', value: 'swap' },
                    { name: 'No Swap', value: 'no-swap' },
                )
        )
        .addBooleanOption(option =>
            option.setName('white')
                .setDescription('Play as Player 1')
        )
        .addBooleanOption(option =>
            option.setName('black')
                .setDescription('Play as Player 2')
        ),
	async execute(interaction, client) {
        const options = interaction.options;
        const opponent = options.getUser('opponent');
        if (!opponent) {
            return interaction.reply({content: 'Invalid opponent', ephemeral: true});
        } else if (isGameOngoing(interaction)) {
            return interaction.reply({content: 'There\'s a game in progress! Use `!tak end` if you\'re sure no one is using this channel.', ephemeral: true});
        } else if (client.user.id === opponent.id) {
            return interaction.reply({content: 'Sorry, I don\'t know how to play yet. I just facilitate games. Challenge someone else!', ephemeral: true});
        } else {
            let player1;
            let displayName1;
            let player2;
            let displayName2;
            let thisPlayer = options.getBoolean('white') ? 1 : options.getBoolean('black') ? 2 : 1 + Math.round(Math.random());
            if (thisPlayer == 1) {
                player1 = interaction.member;
                displayName1 = interaction.member.displayName;
                player2 = opponent;
                displayName2 = opponent.displayName;
            } else {
                player1 = opponent;
                displayName1 = opponent.displayName;
                player2 = interaction.member;
                displayName2 = interaction.member.displayName;
            }
    
            let tps = options.getString('tps');
            let tpsParsed;
            let size;
            if (tps) {
                // TPS
                tpsParsed = parseTPS(tps);
                if (tpsParsed.error) {
                    return interaction.reply({content: tpsParsed.error, ephemeral: true});
                }
                size = tpsParsed.size;
            } else {
                // Size
                size = options.getInteger('size') || 6;
                tps = size;
                if (size < 3 || size > 8) {
                    return interaction.reply({content: 'Invalid board size.', ephemeral: true});
                }
            }
    
            // Komi
            let komi = options.getNumber('komi') || 0;
            if (komi < -4.5 || komi > 4.5) {
                return interaction.reply({content: 'Invalid komi.', ephemeral: true});
            }
    
            // Opening
            let opening = options.getString('opening') || 'swap';
            if (opening != 'swap' && opening != 'no-swap') {
                return interaction.reply({content: 'Invalid opening.', ephemeral: true});
            }
    
            // Theme
            let theme = options.getString('theme');
            if (theme) {
                try {
                    theme = parseTheme(theme);
                } catch(err) {
                    return interaction.reply({content: 'Invalid theme', ephemeral: true});
                }
            } else {
                theme = getTheme(interaction);
            }
    
            // Create game data
            const gameData = {
                player1Id: player1.id,
                player2Id: player2.id,
                player1: displayName1,
                player2: displayName2,
                size,
                komi,
                opening
            };
            if (tpsParsed) {
                gameData.initialTPS = tps;
                gameData.moveNumber = Number(tpsParsed.linenum);
            }
            const gameId = createPtnFile(gameData);
            gameData.gameId = gameId;
    
            let channel = interaction.channel;
            let channelName = `${gameData.player1}-🆚-${gameData.player2}`;
            if (!isGameChannel(interaction)) {
                // Make a new channel
                try {
                    channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: interaction.channel.parent,
                    });
                    await interaction.reply(`<#${channel.id}>`);
                } catch (err) {
                    console.error(err);
                    return interaction.reply({content: 'I wasn\'t able to create a new channel.', ephemeral: true});
                }
            } else {
                // Use existing channel
                interaction.channel.setName(channelName);
            }
    
            let canvas;
            try {
                canvas = drawBoard({ ...gameData, tps }, theme);
            } catch (err) {
                console.error(err);
                return interaction.reply({content: 'Something went wrong when I tried to draw the board.', ephemeral: true});
            }
    
            saveGameData({ channel }, { tps: canvas.id, gameData });
            if (options.getString('theme')) {
                setTheme({ channel }, theme);
            }
            const message = getTurnMessage(gameData, canvas);
            sendPngToDiscord({ channel }, canvas, message);
    
            clearDeleteTimer(interaction);
        }
	},
};
