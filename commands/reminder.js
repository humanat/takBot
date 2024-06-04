const { SlashCommandBuilder } = require("discord.js");
const timestring = require("timestring");
const { sendMessage, saveTimer } = require("../util");

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
			const timestamp = Math.round((new Date().getTime() + delay) / 1e3);
			sendMessage(
				interaction,
				`OK, I will ping you in this channel <t:${timestamp}:R>.`,
				true
			);
			saveTimer(
				"reminder",
				timestamp,
				interaction.channelId,
				interaction.member.id
			);
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
