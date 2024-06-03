const { SlashCommandBuilder } = require("discord.js");
const timestring = require("timestring");
const { sendMessage } = require("../util");

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
			const delayString = interaction.options.getString("delay");
			const delayMs = timestring(delayString) * 1e3;
			const date = Math.round((new Date().getTime() + delayMs) / 1e3);
			sendMessage(
				interaction,
				`OK, I will ping you in this channel <t:${date}:R>.`,
				true
			);
			setTimeout(
				sendMessage,
				delayMs,
				interaction,
				"Hey <@" +
					interaction.member.id +
					">, you wanted me to remind you about this channel."
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
