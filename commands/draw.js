const { SlashCommandBuilder } = require("discord.js");
const {
  addToHistoryFile,
  cleanupFiles,
  clearInactiveTimer,
  getGameData,
  getLink,
  isGameOngoing,
  isPlayer,
  pinMessage,
  renameChannel,
  saveGameData,
  sendMessage,
  setDeleteTimer,
} = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Offer a draw, or accept your opponent's draw offer."),
  async execute(interaction) {
    let gameData = getGameData(interaction);

    if (!gameData) {
      return sendMessage(interaction, "This isn't a game channel.", true);
    }

    if (!isGameOngoing(interaction)) {
      return sendMessage(
        interaction,
        "There is no ongoing game in this channel.",
        true
      );
    }

    if (!isPlayer(interaction.member.id, gameData)) {
      return sendMessage(interaction, "You are not an active player.", true);
    }

    const opponentId =
      interaction.member.id === gameData.player1Id
        ? gameData.player2Id
        : gameData.player1Id;

    // An offer is only valid if the board hasn't changed since it was made.
    const offer = gameData.drawOffer;
    const offerIsValid = offer && offer.tps === gameData.tps;

    // When one player controls both seats, there's no one to accept the offer,
    // so the draw takes effect immediately.
    const isSelfPlay = gameData.player1Id === gameData.player2Id;

    if (!isSelfPlay && offerIsValid && offer.playerId === interaction.member.id) {
      return sendMessage(
        interaction,
        "You've already offered a draw. Waiting for your opponent to accept with `/draw`.",
        true
      );
    }

    if (isSelfPlay || (offerIsValid && offer.playerId === opponentId)) {
      // Offer is accepted (or self-play): end the game as a draw.
      const result = "1/2-1/2";
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
      const finalMessage = await sendMessage(
        interaction,
        `Draw accepted! Game Ended ${result}\nHere's a link to the completed game:\nID: [${
          gameData.gameId
        }](${getLink(gameData.gameId)})`
      );
      clearInactiveTimer(interaction);
      setDeleteTimer(interaction);
      await pinMessage(finalMessage);
      return renameChannel(interaction, false);
    }

    // No valid offer: record this player's draw offer.
    gameData.drawOffer = {
      playerId: interaction.member.id,
      tps: gameData.tps,
    };
    saveGameData(interaction, { gameData });

    return sendMessage(
      interaction,
      `<@${interaction.member.id}> offers a draw. <@${opponentId}>, use \`/draw\` to accept.`
    );
  },
};
