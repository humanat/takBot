const { SlashCommandBuilder } = require("discord.js");
const timestring = require("timestring");
const { sendMessage, setReminder } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reminder")
    .setDescription("Set a reminder ping.")
    .addStringOption((option) =>
      option
        .setName("delay")
        .setDescription('Amount of time until reminder (e.g. "1h 30m")')
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const delay = timestring(interaction.options.getString("delay")) * 1e3;
      setReminder(interaction, delay);
    } catch (err) {
      console.error(err);
      sendMessage(
        interaction,
        "I did not understand how long you wanted me to wait before reminding you.",
        true
      );
    }
  },
};
