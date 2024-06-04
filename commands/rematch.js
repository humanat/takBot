const { SlashCommandBuilder } = require("discord.js");
const {
	clearDeleteTimer,
	createPtnFile,
	drawBoard,
	getGameData,
	getTheme,
	getTurnMessage,
	isPlayer,
	saveGameData,
	sendMessage,
	sendPngToDiscord,
	setInactiveTimer,
} = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("rematch")
		.setDescription("Swap seats and play again using the same game settings."),
	async execute(interaction) {
		const gameData = getGameData(interaction);
		if (!gameData) {
			return sendMessage(
				interaction,
				"I couldn't find a previous game in this channel.",
				true
			);
		} else if (gameData.tps) {
			return sendMessage(
				interaction,
				"There's still a game in progress!",
				true
			);
		} else if (!isPlayer(interaction.member.id, gameData)) {
			return sendMessage(
				interaction,
				"Only the previous players can rematch.",
				true
			);
		}

		// Swap players
		[
			gameData.player1,
			gameData.player1Id,
			gameData.player2,
			gameData.player2Id,
		] = [
			gameData.player2,
			gameData.player2Id,
			gameData.player1,
			gameData.player1Id,
		];

		// Generate new game ID
		const gameId = createPtnFile(gameData);
		gameData.gameId = gameId;

		interaction.channel.setName(`${gameData.player1}-🆚-${gameData.player2}`);
		let canvas;
		try {
			canvas = drawBoard(
				{ ...gameData, tps: gameData.initialTPS || gameData.size },
				getTheme(interaction)
			);
		} catch (err) {
			console.error(err);
			return sendMessage(
				interaction,
				"Something went wrong when I tried to draw the board.",
				true
			);
		}

		saveGameData(interaction, { tps: canvas.id, gameData });
		const message = getTurnMessage(gameData, canvas);
		sendPngToDiscord(interaction, canvas, message);

		clearDeleteTimer(interaction);
		setInactiveTimer(interaction, gameData, canvas);
	},
};
