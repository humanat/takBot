const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('undo')
		.setDescription('Undo your last move.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
