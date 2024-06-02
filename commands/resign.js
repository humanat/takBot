const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('resign')
		.setDescription('Forfeit the current game.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
