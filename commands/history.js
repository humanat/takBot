const { SlashCommandBuilder } = require("discord.js");
const { getHistoryFromFile, sendMessage } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription(
      "Get a list of finished games and their IDs. Use a page number to see older games."
    )
    .addIntegerOption((option) =>
      option.setName("page").setDescription("Page number")
    ),
  async execute(interaction) {
    try {
      const page = interaction.options.getInteger("page") || 1;
      let historyData = getHistoryFromFile(page);
      if (historyData) {
        return sendMessage(interaction, "```\n" + historyData + "\n```", true);
      } else {
        return sendMessage(interaction, "Not a valid page number", true);
      }
    } catch (err) {
      console.error(err);
    }
  },
};
