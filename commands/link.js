const {SlashCommandBuilder} = require('discord.js');
const {compressToEncodedURIComponent} = require('lz-string');
const {getGameData} = require('../util');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('link')
		.setDescription('Get a ptn.ninja link for the current game, or the game specified by ID.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('ID of completed game')
        ),
	async execute(interaction) {
        const gameId = interaction.options.getString('game');
        if (!gameId) {
            let gameData = getGameData(interaction);
            if (!gameData) {
                return interaction.reply({content: 'You must use the game ID to get a link for a completed game. See `!tak history` to get the game ID.', ephemeral: true});
            }
            gameId = gameData.gameId;
        }
    
        let ptn = getPtnFromFile(gameId);
        if (!ptn) {
            return interaction.reply({content: 'I couldn\'t find a game with that ID.', ephemeral: true});
        } else {
            return interaction.reply(`<https://ptn.ninja/${compressToEncodedURIComponent(ptn)}>`);
        }
	},
};
