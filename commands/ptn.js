const { SlashCommandBuilder } = require("discord.js");
const { getGameData, getPlies, sendMessage } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ptn")
    .setDescription(
      "Get unformatted ptn for the current game."
    ),
  async execute(interaction) {
    let gameData = getGameData(interaction);
    if (!gameData) {
      return sendMessage(
        interaction,
        "There is no ongoing game in this channel.",
        true
      );
    }
    if (gameData.allowLinks === false) {
      return sendMessage(
        interaction,
        "Sorry, this command is unavailable when links are disallowed.",
        true
      );
    }
    gameId = gameData.gameId;

    try {
      return sendMessage(interaction, getPlies(gameId), true);
    } catch (error) {
      return sendMessage(
        interaction,
        "I wasn't able to get the plies for the ongoing game.",
        true
      );
    }
  },
};
