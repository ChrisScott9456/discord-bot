import 'dotenv/config';
import { EmbedBuilder, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { Events as DistubeEvents } from 'distube';
import { Commands } from './commands';
import { MyClient } from './classes/MyClient';
import { EmbedErrorMessages, errorEmbed } from './utils/errorEmbed';
import { replyWrapper } from './utils/replyWrapper';
import { createPollJob, endPollJob } from './utils/poll';
import { APPLICATION_ID, DISCORD_TOKEN } from './lib/envVariables';
import { createTables } from './lib/knex';
import { DisTubeCommand, PaginationCommands, PaginationCustomId } from './interfaces/Command';
import { setDefaultPresence } from './utils/defaultPresence';
import { deserialize } from './utils/deserialize';
import { QueueCommand } from './commands/youtube/queue';

// Create a new client instance
export const client = new MyClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessagePolls,
	],
});

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(DISCORD_TOKEN);

/*
 * Client Ready
 */
client.once(Events.ClientReady, async (readyClient) => {
	if (!client.user || !client.application) {
		return;
	}

	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

	try {
		createPollJob.start();
		endPollJob.start();
		await createTables();

		console.log('Registering the following commands:');
		console.log(`[${Array.from(Commands.keys()).join(', ')}]`);

		// Registers the commands in the Discord server
		// This process can take up to an hour for results to register on server
		await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: Array.from(Commands.values()).map((command) => command.slashCommandBuilder.toJSON()) });

		console.log(`Finished registering commands.`);
	} catch (error) {
		console.error(error);
	}
});

/*
 * Listens to chat commands and buttons to execute run() command
 */
client.on(Events.InteractionCreate, async (interaction) => {
	// Check if interaction is a chat command or a button command
	if (!(interaction.isChatInputCommand() || interaction.isButton())) return;

	// If the interaction is a button command, only execute if it is a DistubeCommand
	if (interaction.isButton() && !Object.values(DisTubeCommand).includes(interaction.customId as DisTubeCommand)) return;

	try {
		const command = interaction.isChatInputCommand() ? Commands.get(interaction.commandName) : interaction.isButton() ? Commands.get(interaction.customId) : null;

		await command.run({ interaction });
	} catch (error) {
		await replyWrapper({ message: errorEmbed(error?.embedMessage || EmbedErrorMessages.GENERAL_ERROR), interaction });

		console.error(error);
	}
});

/*
 * Listens to when queue pagination buttons are pressed
 */
client.on(Events.InteractionCreate, async (interaction) => {
	// Only execute if Button interaction and is one of PaginationCommands
	if (interaction.isButton()) {
		const customId = deserialize<PaginationCustomId>(interaction.customId);

		if (customId && Object.values(PaginationCommands).includes(customId.id as PaginationCommands)) {
			let page = customId.page;

			if (customId.id === PaginationCommands.PREVIOUS_PAGE) page--;
			if (customId.id === PaginationCommands.NEXT_PAGE) page++;

			await (Commands.get(DisTubeCommand.QUEUE) as QueueCommand).run({ interaction }, page);
		}
	}
});

/*
 * Listens to when the current distube queue changes songs
 */
client.distube.on(DistubeEvents.PLAY_SONG, async (queue, song) => {
	await Commands.get(DisTubeCommand.QUEUE).run({ channel: queue.textChannel });

	client.user.setPresence({ status: 'online', activities: [{ name: song.name, type: 0, state: song.url }] });
});

/*
 * Listens for individual songs added to queue
 */
client.distube.on(DistubeEvents.ADD_SONG, async (queue, song) => {
	queue.textChannel.send({
		embeds: [
			new EmbedBuilder()
				.setColor('Blurple')
				.setTitle('Queued Song')
				.setThumbnail(song.thumbnail)
				.setAuthor({ name: song.member.displayName, iconURL: song.member.avatarURL() })
				.setDescription(`**[${song.name || song.url}](${song.url})**\n`),
		],
	});
});

/*
 * Listens for playlists added to queue
 */
client.distube.on(DistubeEvents.ADD_LIST, async (queue, playlist) => {
	queue.textChannel.send({
		embeds: [
			new EmbedBuilder()
				.setColor('Blurple')
				.setTitle('Queued Playlist')
				.setThumbnail(playlist.thumbnail)
				.setAuthor({ name: playlist.member.displayName, iconURL: playlist.member.avatarURL() })
				.setDescription(`**[${playlist.name || playlist.url}](${playlist.url})**\n`),
		],
	});
});

client.distube.on(DistubeEvents.FINISH, setDefaultPresence);
client.distube.on(DistubeEvents.DELETE_QUEUE, setDefaultPresence);

/*
 * Listens to and logs any errors that occur
 */
client.on(Events.Error, (error) => {
	console.error(error);
});

client.distube.on(DistubeEvents.ERROR, (error) => {
	console.error(error);
	setDefaultPresence();
});
