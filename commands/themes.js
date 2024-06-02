const {SlashCommandBuilder} = require('discord.js');
const {themes} = require('../TPS-Ninja/src/themes');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('themes')
		.setDescription('Get a list of themes for the board and pieces.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
