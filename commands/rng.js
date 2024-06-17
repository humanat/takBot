const { SlashCommandBuilder } = require("discord.js");
const { sendMessage } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rng")
    .setDescription("Generate a random number >= 1")
    .addIntegerOption((option) =>
      option
        .setName("max")
        .setDescription("The highest possible number")
        .setMinValue(2)
        .setRequired(true)
    ),
  async execute(interaction) {
    const max = interaction.options.getInteger("max");
    const rand = 1 + Math.floor(Math.random() * max);
    return sendMessage(interaction, rand.toString(), true);
  },
};
