const { SlashCommandBuilder } = require("discord.js");
const { sendMessage } = require("../util");
const chrono = require("chrono-node");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("datetime")
		.setDescription("Display a date/time in everyone's local time zone.")
		.addStringOption((option) =>
			option
				.setName("datetime")
				.setDescription(
					"A date and/or time, specified in natural language or a standard format"
				)
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("format")
				.setDescription("How you want the date to appear")
				.setRequired(true)
				.addChoices(
					{ name: "Relative", value: "R" },
					{ name: "Short Date and Time", value: "f" },
					{ name: "Long Date and Time", value: "F" },
					{ name: "Short Date", value: "d" },
					{ name: "Long Date", value: "D" },
					{ name: "Short Time", value: "t" },
					{ name: "Long Time", value: "T" }
				)
		),
	async execute(interaction) {
		const datetime = interaction.options.getString("datetime");
		const format = interaction.options.getString("format") || "R";
		try {
			const timestamp = Math.round(
				Date.parse(chrono.parseDate(datetime)) / 1e3
			);
			if (isNaN(timestamp)) {
				throw "invalid datetime";
			}
			sendMessage(interaction, `<t:${timestamp}:${format}>`);
		} catch (err) {
			sendMessage(
				interaction,
				"I'm sorry, I couldn't understand that date.",
				true
			);
		}
	},
};
