const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('Get a list of finished games and their IDs. Use a page number to see older games.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
