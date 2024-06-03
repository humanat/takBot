const { SlashCommandBuilder } = require("discord.js");
const {
	cleanupFiles,
	clearReminderTimer,
	deletePtnFile,
	getGameData,
	getLink,
	isGameOngoing,
	renameChannel,
	sendMessage,
	setDeleteTimer,
} = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("end")
		.setDescription("Cancel the current game."),
	async execute(interaction) {
		if (!isGameOngoing(interaction)) {
			return sendMessage(
				interaction,
				"There is no ongoing game in this channel.",
				true
			);
		}

		const gameData = getGameData(interaction);
		if (gameData.hl) {
			await sendMessage(
				interaction,
				"Here's a link to the game:\n" + getLink(gameData.gameId)
			);
		}
		cleanupFiles(interaction);
		deletePtnFile(gameData);
		clearReminderTimer(interaction);
		setDeleteTimer(interaction);
		await sendMessage(
			interaction,
			"Ongoing game in this channel has been removed."
		);
		return renameChannel(interaction, false);
	},
};
