const { SlashCommandBuilder } = require("discord.js");
const { getGameData, getLink, sendMessage } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription(
      "Get a ptn.ninja link for the current game, or the game specified by ID."
    )
    .addStringOption((option) =>
      option.setName("game").setDescription("ID of completed game")
    ),
  async execute(interaction) {
    let gameId = interaction.options
      ? interaction.options.getString("game")
      : null;
    let message = "";
    if (gameId) {
      message = `Game ID: ${gameId}\n`;
    } else {
      let gameData = getGameData(interaction);
      if (!gameData) {
        return sendMessage(
          interaction,
          "You must use the game ID to get a link for a completed game. See `/history` to get the game ID.",
          true
        );
      }
      gameId = gameData.gameId;
    }

    try {
      const link = getLink(gameId);
      return sendMessage(interaction, message + link);
    } catch (error) {
      return sendMessage(
        interaction,
        "I couldn't find a game with that ID.",
        true
      );
    }
  },
};
