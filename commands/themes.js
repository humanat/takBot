const { SlashCommandBuilder } = require("discord.js");
const { sendMessage } = require("../util");
const { themes } = require("../TPS-Ninja/src/themes");
const themeIDs = Object.values(themes).map(({ id }) => id);

module.exports = {
	data: new SlashCommandBuilder()
		.setName("themes")
		.setDescription("Get a list of themes for the board and pieces."),
	async execute(interaction) {
		return sendMessage(interaction, themeIDs.join("\n"), true);
	},
};
