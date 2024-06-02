const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('end')
		.setDescription('Cancel the current game.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
