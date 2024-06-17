const { SlashCommandBuilder } = require("discord.js");
const {
  drawBoard,
  getGameData,
  getTheme,
  getTurnMessage,
  isGameOngoing,
  sendMessage,
  sendPngToDiscord,
} = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redraw")
    .setDescription("Re-send the last board of the current game."),
  async execute(interaction) {
    if (!isGameOngoing(interaction)) {
      return sendMessage(
        interaction,
        "I couldn't find an ongoing game in this channel.",
        true
      );
    }
    const gameData = getGameData(interaction);
    const canvas = drawBoard(gameData, getTheme(interaction));
    const message = getTurnMessage(gameData, canvas);
    await sendPngToDiscord(interaction, canvas, message);
  },
};
