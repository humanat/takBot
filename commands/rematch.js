const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rematch')
		.setDescription('Swap seats and play again using the same game settings.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
