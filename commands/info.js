const { SlashCommandBuilder } = require("discord.js");
const { getGameData, isGameOngoing, sendMessage } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Get information about the current game."),
  async execute(interaction) {
    const gameData = getGameData(interaction);
    if (gameData) {
      if(gameData.allowLinks === false){
        return sendMessage(interaction, "Sorry, this command is unavailable when links are disallowed.", true);
      } else {
        return sendMessage(interaction, JSON.stringify(gameData), true);
      }
    } else if (!isGameOngoing(interaction)) {
      return sendMessage(
        interaction,
        "There is no ongoing game in this channel.",
        true
      );
    } else {
      return sendMessage(interaction, "This isn't a game channel.", true);
    }
  },
};
