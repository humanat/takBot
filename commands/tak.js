const { ChannelType, SlashCommandBuilder } = require("discord.js");
const { parseTPS, parseTheme } = require("../TPS-Ninja/src");
const { themes } = require("../TPS-Ninja/src/themes");
const themeIDs = Object.values(themes).map(({ id }) => id);
const {
	clearDeleteTimer,
	createPtnFile,
	drawBoard,
	getTheme,
	getTurnMessage,
	isGameChannel,
	isGameOngoing,
	saveGameData,
	sendMessage,
	sendPngToDiscord,
	setTheme,
} = require("../util");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("tak")
		.setDescription("Begins a game of Tak against the specified opponent.")
		.addUserOption((option) =>
			option
				.setName("opponent")
				.setDescription("Your opponent")
				.setRequired(true)
		)
		.addIntegerOption((option) =>
			option
				.setName("size")
				.setDescription("Board size")
				.addChoices(
					{ name: "3x3", value: 3 },
					{ name: "4x4", value: 4 },
					{ name: "5x5", value: 5 },
					{ name: "6x6 (default)", value: 6 },
					{ name: "7x7", value: 7 },
					{ name: "8x8", value: 8 }
				)
		)
		.addNumberOption((option) =>
			option
				.setName("komi")
				.setDescription("Komi")
				.addChoices(
					{ name: "4.5", value: 4.5 },
					{ name: "4", value: 4 },
					{ name: "3.5", value: 3.5 },
					{ name: "3", value: 3 },
					{ name: "2.5", value: 2.5 },
					{ name: "2", value: 2 },
					{ name: "1.5", value: 1.5 },
					{ name: "1", value: 1 },
					{ name: "0.5", value: 0.5 },
					{ name: "0 (default)", value: 0 },
					{ name: "-0.5", value: -0.5 },
					{ name: "-1", value: -1 },
					{ name: "-1.5", value: -1.5 },
					{ name: "-2", value: -2 },
					{ name: "-2.5", value: -2.5 },
					{ name: "-3", value: -3 },
					{ name: "-3.5", value: -3.5 },
					{ name: "-4", value: -4 },
					{ name: "-4.5", value: -4.5 }
				)
		)
		.addStringOption((option) =>
			option.setName("tps").setDescription("Initial TPS")
		)
		.addIntegerOption((option) =>
			option
				.setName("color")
				.setDescription("Choose your color")
				.addChoices({ name: "White (Player 1)", value: 1 }, { name: "Black (Player 2)", value: 2 })
		)
		.addStringOption((option) =>
			option
				.setName("opening")
				.setDescription("Opening variation")
				.addChoices(
					{ name: "Swap", value: "swap" },
					{ name: "No Swap", value: "no-swap" }
				)
		)
		.addStringOption((option) =>
			option
				.setName("theme")
				.setDescription("Theme name or JSON")
				.setAutocomplete(true)
		),
	async autocomplete(interaction) {
		console.log(interaction);
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === "theme") {
			const focusedValue = focusedOption.value.toLowerCase();
			return interaction.respond(
				themeIDs
					.filter((choice) => choice.startsWith(focusedValue))
					.map((choice) => ({ name: choice, value: choice }))
			);
		}
	},
	async execute(interaction, client) {
		const options = interaction.options;
		const opponent = options.getUser("opponent");
		if (!opponent) {
			return sendMessage(interaction, "Invalid opponent", true);
		} else if (isGameOngoing(interaction)) {
			return sendMessage(
				interaction,
				"There's a game in progress! Use `/end` if you're sure no one is using this channel.",
				true
			);
		} else if (client.user.id === opponent.id) {
			return sendMessage(
				interaction,
				"Sorry, I don't know how to play yet. I just facilitate games. Challenge someone else!",
				true
			);
		} else {
			let player1;
			let displayName1;
			let player2;
			let displayName2;
			let thisPlayer =
				options.getInteger("color") || 1 + Math.round(Math.random());
			if (thisPlayer == 1) {
				player1 = interaction.member;
				displayName1 = interaction.member.displayName;
				player2 = opponent;
				displayName2 = opponent.displayName;
			} else {
				player1 = opponent;
				displayName1 = opponent.displayName;
				player2 = interaction.member;
				displayName2 = interaction.member.displayName;
			}

			let tps = options.getString("tps");
			let tpsParsed;
			let size;
			if (tps) {
				// TPS
				tpsParsed = parseTPS(tps);
				if (tpsParsed.error) {
					return sendMessage(interaction, tpsParsed.error, true);
				}
				size = tpsParsed.size;
			} else {
				// Size
				size = options.getInteger("size") || 6;
				tps = size;
				if (size < 3 || size > 8) {
					return sendMessage(interaction, "Invalid board size.", true);
				}
			}

			// Komi
			let komi = options.getNumber("komi") || 0;
			if (komi < -4.5 || komi > 4.5) {
				return sendMessage(interaction, "Invalid komi.", true);
			}

			// Opening
			let opening = options.getString("opening") || "swap";
			if (opening != "swap" && opening != "no-swap") {
				return sendMessage(interaction, "Invalid opening.", true);
			}

			// Theme
			let theme = options.getString("theme");
			if (theme) {
				try {
					theme = parseTheme(theme);
				} catch (err) {
					return sendMessage(interaction, "Invalid theme", true);
				}
			} else {
				theme = getTheme(interaction);
			}

			// Create game data
			const gameData = {
				player1Id: player1.id,
				player2Id: player2.id,
				player1: displayName1,
				player2: displayName2,
				size,
				komi,
				opening,
			};
			if (tpsParsed) {
				gameData.initialTPS = tps;
				gameData.moveNumber = Number(tpsParsed.linenum);
			}
			const gameId = createPtnFile(gameData);
			gameData.gameId = gameId;

			let channel = interaction.channel;
			let channelName = `${gameData.player1}-🆚-${gameData.player2}`;
			if (!isGameChannel(interaction)) {
				// Make a new channel
				try {
					channel = await interaction.guild.channels.create({
						name: channelName,
						type: ChannelType.GuildText,
						parent: interaction.channel.parent,
					});
					await sendMessage(interaction, `<#${channel.id}>`);
				} catch (err) {
					console.error(err);
					return sendMessage(
						interaction,
						"I wasn't able to create a new channel.",
						true
					);
				}
			} else {
				// Use existing channel
				interaction.channel.setName(channelName);
			}

			let canvas;
			try {
				canvas = drawBoard({ ...gameData, tps }, theme);
			} catch (err) {
				console.error(err);
				return sendMessage(
					interaction,
					"Something went wrong when I tried to draw the board.",
					true
				);
			}

			saveGameData({ channel }, { tps: canvas.id, gameData });
			if (options.getString("theme")) {
				setTheme({ channel }, theme);
			}
			const message = getTurnMessage(gameData, canvas);
			sendPngToDiscord({ channel }, canvas, message);

			clearDeleteTimer(interaction);
		}
	},
};
