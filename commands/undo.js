const { SlashCommandBuilder } = require("discord.js");
const {
	clearReminderTimer,
	deleteLastTurn,
	drawBoard,
	getGameData,
	getTheme,
	getTurnMessage,
	isGameOngoing,
	isPlayer,
	sendMessage,
	sendPngToDiscord,
	setReminderTimer,
} = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("undo")
		.setDescription("Undo your last move."),
	async execute(interaction) {
		let gameData = getGameData(interaction);
		if (!gameData) {
			return sendMessage(interaction, "This isn't a game channel.", true);
		}

		if (!gameData.hl) {
			return sendMessage(interaction, "There's nothing to undo.", true);
		}

		if (!isGameOngoing(interaction)) {
			return sendMessage(
				interaction,
				"The game is over, but you can start a new game using the `tps` option to resume from the last position!",
				true
			);
		}

		if (!isPlayer(interaction, gameData)) {
			return;
		}

		if (
			(gameData.turnMarker === "1" &&
				interaction.member.id != gameData.player2Id) ||
			(gameData.turnMarker === "2" &&
				interaction.member.id != gameData.player1Id)
		) {
			return sendMessage(
				interaction,
				"You cannot undo a move that is not your own.",
				true
			);
		}

		deleteLastTurn(interaction, gameData);
		gameData = getGameData(interaction);
		const canvas = drawBoard(gameData, getTheme(interaction));
		const message = "Undo complete!\n" + getTurnMessage(gameData, canvas);

		clearReminderTimer(interaction);
		setReminderTimer(interaction, gameData, canvas);

		return sendPngToDiscord(interaction, canvas, message);
	},
};
