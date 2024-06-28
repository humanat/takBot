const { SlashCommandBuilder } = require("discord.js");
const { handleDelete } = require("../util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete the current game channel."),
  async execute(interaction) {
    return handleDelete(interaction, interaction.member.id);
  },
};
