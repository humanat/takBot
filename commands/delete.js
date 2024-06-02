const {SlashCommandBuilder} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription('Delete the current game channel.'),
	async execute(interaction) {
		// interaction.member.username
		await interaction.reply();
	},
};
