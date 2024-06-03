const { SlashCommandBuilder } = require("discord.js");
const { sendHelp } = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Get an overview of this bot's features."),
	async execute(interaction) {
		sendHelp(interaction);
	},
};
