const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('theme')
		.setDescription('Get or set the theme for the current channel.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
