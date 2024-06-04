const { SlashCommandBuilder } = require("discord.js");
const { getGameData, isGameOngoing, sendMessage } = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("info")
		.setDescription("Get information about the current game."),
	async execute(interaction) {
		const gameData = getGameData(interaction);
		if (gameData) {
			return sendMessage(
				interaction,
				"```json\n" + JSON.stringify(gameData, null, 2) + "\n```",
				true
			);
		} else if (!isGameOngoing(interaction)) {
			return sendMessage(
				interaction,
				"The game is over, but you can start a new game using the --tps flag!",
				true
			);
		} else {
			return sendMessage(interaction, "This isn't a game channel.", true);
		}
	},
};
