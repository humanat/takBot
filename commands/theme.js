const { SlashCommandBuilder } = require("discord.js");
const { parseTheme } = require("../TPS-Ninja/src");
const {
	getGameData,
	getTheme,
	isGameChannel,
	isGameOngoing,
	isPlayer,
	sendMessage,
	setTheme,
} = require("../util");
const handleRedraw = require("./redraw").execute;

module.exports = {
	data: new SlashCommandBuilder()
		.setName("theme")
		.setDescription("Get or set the theme for the current channel.")
		.addStringOption((option) =>
			option
				.setName("theme")
				.setDescription("Theme name or JSON")
				.setAutocomplete(true)
		),
	async execute(interaction) {
		let theme = interaction.options.getString("theme");
		if (!isGameChannel(interaction)) {
			return sendMessage(interaction, "This isn't a game channel.", true);
		} else if (theme) {
			const gameData = getGameData(interaction);
			const isOngoing = isGameOngoing(interaction);
			if (!isPlayer(interaction.member.id, gameData)) {
				return sendMessage(
					interaction,
					`Only the ${
						isOngoing ? "current" : "previous"
					} players may change the theme.`,
					true
				);
			}

			try {
				parseTheme(theme);
			} catch (err) {
				console.error(err);
				return sendMessage(interaction, "Invalid theme", true);
			}
			if (setTheme(interaction, theme)) {
				if (!isGameOngoing(interaction)) {
					return sendMessage(interaction, "Theme set.", true);
				} else {
					handleRedraw(interaction);
				}
			}
		} else {
			theme = getTheme(interaction);
			return sendMessage(
				interaction,
				theme[0] === "{" ? `\`\`\`\n${theme}\n\`\`\`` : theme,
				true
			);
		}
	},
};
