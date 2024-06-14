import type { AuctionLot } from '../types/auction';
import type { APIEmbedField, Collection, GuildTextBasedChannel } from 'discord.js';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
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

export function TopSellersEmbed(topSellers: Collection<string, number>) {
	let topSellerString = '';
	topSellers.forEach((amount, sellerName) => {
		topSellerString += `${Constants.EMOTES.LIST_ITEM} ${sellerName} (${amount.toLocaleString('en-US')})\n`;
	});

	return new EmbedBuilder()
		.setDescription(`# ${Constants.EMOTES.AHC_BANNER} Top Sellers\n\n${topSellerString}`)
		.setColor(Constants.EMBED_COLOR)
		.setThumbnail(Constants.TOP_SELLER_THUMBNAIL)
		.setAuthor({
			name: 'AHF Info Center',
			iconURL: Constants.EMBED_AUTHOR_ICON,
			url: Constants.INFO_CENTER_LINK,
		});
}

export function MemberStatusEmbed(member: AhfGuildMemberSheetData) {
	// Get raffle status keys as they are dynamic
	const vinnyRaffleKey = Object.keys(member).find((key) => key.startsWith('Vinny Raffle Tickets')) || 'Vinny Raffle Tickets';
	const bonusRaffleKey = Object.keys(member).find((key) => key.startsWith('Vinny Bonus Tickets')) || 'Vinny Bonus Tickets';

	return new EmbedBuilder()
		.setTitle('Your AHC Status')
		.setAuthor({
			name: 'AHF Info Center',
			iconURL: Constants.EMBED_AUTHOR_ICON,
			url: Constants.INFO_CENTER_LINK,
		})
		.setColor(Constants.EMBED_COLOR)
		.setDescription(`Hello ${member.Who}! Check your AHC Status below!`)
		.setFields([
			{
				name: 'User ID',
				value: member.Who,
				inline: true,
			},
			{
				name: 'Sales',
				value: member.Sales.toLocaleString('en-us'),
				inline: true,
			},
			{
				name: 'Requirements Met',
				value: member.Safe ? `${Constants.EMOTES.CHECK} Yes` : `${Constants.EMOTES.CANCEL} No`,
				inline: true,
			},
			{
				name: 'Vinny Raffle Tickets',
				value: Number(member[vinnyRaffleKey] || 0).toLocaleString('en-us'),
				inline: true,
			},
			{
				name: 'Cash Stash Tickets',
				value: Number(member[bonusRaffleKey] || 0).toLocaleString('en-us'),
				inline: true,
			},
			{
				name: 'Mat Raffle Tickets',
				value: Number(member['Mat Raffle Tickets'] || 0).toLocaleString('en-us'),
				inline: true,
			},
		])
		.setThumbnail(Constants.AHC_BANNER_IMAGE);
}
