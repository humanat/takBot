const { SlashCommandBuilder } = require("discord.js");
const {
	addPlyToPtnFile,
	addToHistoryFile,
	cleanupFiles,
	clearInactiveTimer,
	getGameData,
	getLink,
	renameChannel,
	sendMessage,
	setDeleteTimer,
} = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("resign")
		.setDescription("Forfeit the current game."),
	async execute(interaction) {
		let gameData = getGameData(interaction);

		if (!gameData) {
			return sendMessage(
				interaction,
				"There is no ongoing game in this channel.",
				true
			);
		}

		let result;
		if (interaction.member.id === gameData.player1Id) {
			result = "0-1";
		} else if (interaction.member.id === gameData.player2Id) {
			result = "1-0";
		} else {
			return sendMessage(interaction, "You are not an active player.", true);
		}

		let nextPlayer = gameData.player1Id;
		if (gameData.turnMarker === "1") nextPlayer = gameData.player2Id;
		addPlyToPtnFile(gameData.gameId, result);
		cleanupFiles(interaction.channel.id);
		if (gameData.gameId) {
			addToHistoryFile({
				gameId: gameData.gameId,
				player1: gameData.player1,
				player2: gameData.player2,
				komi: gameData.komi,
				opening: gameData.opening,
				result: result,
			});
		}
		await sendMessage(
			interaction,
			`GG <@${nextPlayer}>! Game Ended ${result}\nHere's a link to the completed game:\nID: [${
				gameData.gameId
			}](${getLink(gameData.gameId)})`
		);
		clearInactiveTimer(interaction);
		setDeleteTimer(interaction);
		return renameChannel(interaction, false);
	},
};
