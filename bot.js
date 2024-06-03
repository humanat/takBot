const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");
const auth = require("./auth.json");

const { cleanupFiles, handleMove, sendMessage, validPly } = require("./util");

const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.MessageContent,
	],
});

// Load slash commands

client.commands = new Discord.Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
	.readdirSync(commandsPath)
	.filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ("data" in command && "execute" in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
		);
	}
}

// Main code

client.on(Discord.Events.ClientReady, () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Discord.Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction, client);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		} else {
			await interaction.reply({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		}
	}
});

client.on(Discord.Events.MessageCreate, (msg) => {
	let message = msg.content.trim();
	if (message.length >= 4 && message.substring(0, 4).toLowerCase() === "!tak") {
		sendMessage(msg, "Please use my new slash commands!");
	} else if (validPly(message)) {
		return handleMove(msg, message);
	}
});

client.on(Discord.Events.ChannelDelete, function (channel) {
	return cleanupFiles({ channel }, true);
});

client.on(Discord.Events.Error, (error) => {
	console.log(`ERROR: ${error}`);
});

client.on(Discord.Events.Warn, (warning) => {
	console.log(`WARNING: ${warning}`);
});

client.on(Discord.Events.RateLimit, (info) => {
	console.log(`RATE_LIMIT: ${info}`);
});

process.on("unhandledRejection", (error) => {
	console.error("Unhandled promise rejection:", error);
});

client.login(auth.token);
