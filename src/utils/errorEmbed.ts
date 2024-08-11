import { EmbedBuilder } from 'discord.js';

export enum EmbedErrorMessages {
	GENERAL_ERROR = 'There was an error executing that command!',
	EMPTY_QUEUE = 'There are no songs in the queue!',
	VOICE_CHANNEL_REQUIRED = 'You must be in a voice channel to use this command!',
	NO_PREVIOUS_SONGS = 'There are no previous songs in the queue to play!',
	SEEK_ERROR = 'You cannot seek to a timestamp outside the length of the song!',
}

export class EmbedError extends Error {
	readonly embedMessage: EmbedErrorMessages;

	constructor(error: EmbedErrorMessages) {
		super(error);
		this.embedMessage = error;
	}
}

export function errorEmbed(errorMessage: EmbedErrorMessages) {
	return {
		embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`**${errorMessage}**`)],
	};
}