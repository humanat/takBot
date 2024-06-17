const { SlashCommandBuilder } = require("discord.js");
const {
  cleanupFiles,
  clearInactiveTimer,
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
    let message = "The game in this channel has been removed.";
    if (gameData.hl) {
      message +=
        "\nHere's a link to the unfinished game:\n" + getLink(gameData.gameId);
    }
    cleanupFiles(interaction.channel.id);
    deletePtnFile(gameData);
    await sendMessage(interaction, message);
    clearInactiveTimer(interaction);
    setDeleteTimer(interaction);
    return renameChannel(interaction, false);
  },
};
