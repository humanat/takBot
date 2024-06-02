const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reminder')
		.setDescription('Set a reminder ping.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
