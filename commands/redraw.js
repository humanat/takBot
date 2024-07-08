const { SlashCommandBuilder } = require("discord.js");
const {
  clearInactiveTimer,
  drawBoard,
  getGameData,
  getTheme,
  getTurnMessage,
  isGameOngoing,
  sendMessage,
  sendPngToDiscord,
  setInactiveTimer,
} = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redraw")
    .setDescription("Re-send the last board of the current game."),
  async execute(interaction) {
    if (!isGameOngoing(interaction)) {
      return sendMessage(
        interaction,
        "There is no ongoing game in this channel.",
        true
      );
    }
    const gameData = getGameData(interaction);
    const canvas = drawBoard(gameData, getTheme(interaction));
    const message = getTurnMessage(gameData, canvas);

    clearInactiveTimer(interaction);
    setInactiveTimer(interaction, gameData, canvas);

    return sendPngToDiscord(interaction, canvas, message);
  },
};
