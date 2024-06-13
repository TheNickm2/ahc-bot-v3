import type { AuctionLot } from '../types/auction';
import type { APIEmbedField, GuildTextBasedChannel } from 'discord.js';
import { EmbedBuilder } from '@discordjs/builders';
import { Constants } from '../config/constants';

export interface AuctionLotEmbedProps {
	lotInfo: AuctionLot;
	lotNumber: number;
}

export function AuctionLotEmbed({ lotInfo, lotNumber }: AuctionLotEmbedProps) {
	if (!lotInfo || !lotNumber) {
		throw new Error('Missing required props for AuctionLotEmbed');
	}
	const fields = [
		{
			name: 'Starting Bid',
			value: `${Constants.EMOTES.COIN} ${lotInfo.startingBid.toLocaleString('en-us')}`,
			inline: true,
		},
	];
	return new EmbedBuilder()
		.setTitle(`Lot ${lotNumber}: ${lotInfo.title}`)
		.setDescription(lotInfo.description)
		.setImage(lotInfo.image || '')
		.setFields(fields)
		.setColor(Constants.EMBED_COLOR);
}

export interface AuctionSummaryEmbedProps {
	auctionLots: Array<AuctionLot & { messageId: string }>;
	endDate: Date;
	channel: GuildTextBasedChannel;
}
export function AuctionSummaryEmbed({ auctionLots, endDate, channel }: AuctionSummaryEmbedProps) {
	const fields: APIEmbedField[] = [];
	auctionLots.forEach((lot, index) =>
		fields.push({
			name: `Lot ${index + 1} | ${lot.title}`,
			value: `[Jump to lot →](https://discord.com/channels/${channel.guild.id}/${channel.id}/${lot.messageId ?? ''})`,
		}),
	);
	const endTimestamp = Math.round(endDate.getTime() / 1000);
	return new EmbedBuilder()
		.setTitle(`Auction Summary ${Constants.EMOTES.COIN}`)
		.setDescription(`**Auction Ends <t:${endTimestamp}:R>**\nGet your bids in before <t:${endTimestamp}:f> (your local time) ⏰`)
		.setColor(Constants.EMBED_COLOR)
		.setFooter({ text: 'Auction Posted' })
		.setTimestamp()
		.setFields(fields);
}

export function TimestampHelperEmbed(date: Date) {
	const timestamp = Math.round(date.getTime() / 1000);
	const allFormats = [
		`<t:${timestamp}:d>`, // 06/13/2024
		`<t:${timestamp}:D>`, // June 13, 2024
		`<t:${timestamp}:t>`, // 10:00 AM
		`<t:${timestamp}:T>`, // 10:00:00 AM
		`<t:${timestamp}:f>`, // June 13, 2024 10:00 AM
		`<t:${timestamp}:F>`, // Thursday, June 13, 2024 10:00 AM
		`<t:${timestamp}:R>`, // in 2 hours
	];

	return new EmbedBuilder()
		.setTitle('Timestamp Helper')
		.setDescription(allFormats.map((format) => `\`${format}\`: ${format}`).join('\n\n'))
		.setColor(Constants.EMBED_COLOR);
}

export function InfoCenterEmbed() {
	return new EmbedBuilder()
		.setTitle('AHF Info Center')
		.setURL(Constants.INFO_CENTER_LINK)
		.setAuthor({
			name: 'AHF Info Center',
			iconURL: Constants.EMBED_AUTHOR_ICON,
			url: Constants.INFO_CENTER_LINK,
		})
		.setColor(Constants.EMBED_COLOR)
		.setDescription(
			`Click the buttons below to navigate the AHC Info Center right here within Discord (or click "AHF Info Center" above to open the full info center in your web browser!)\n\nThe AHC Info Center is typically updated at least once daily, but may not always show real-time data.`,
		);
}
