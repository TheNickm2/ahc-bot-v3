import type { Collection, GuildTextBasedChannel } from 'discord.js';
import { ContainerBuilder, SeparatorSpacingSize } from 'discord.js';
import type { AuctionLot } from '../types/auction';
import { Constants } from '../config/constants';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
import type { ReminderRow } from '../types/database';

export interface AuctionLotMessageComponentsProps {
  lotInfo: AuctionLot;
  lotNumber: number;
}
export function AuctionLotMessageComponents({ lotInfo, lotNumber }: AuctionLotMessageComponentsProps) {
  if (!lotInfo || !lotNumber) {
    throw new Error('Missing required props for AuctionLotMessageComponents');
  }
  return new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Lot ${lotNumber}: ${lotInfo.title}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(lotInfo.description))
    .addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(`**Starting Bid**\n${Constants.EMOTES.COIN} ${lotInfo.startingBid.toLocaleString('en-us')}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(lotInfo.image || '').setDescription(`Image for Lot ${lotNumber} - ${lotInfo.title}`)),
    );
}

export interface AuctionSummaryMessageComponentsProps {
  auctionLots: Array<AuctionLot & { messageId: string }>;
  endDate: Date;
  channel: GuildTextBasedChannel;
}
export function AuctionSummaryMessageComponents({ auctionLots, endDate, channel }: AuctionSummaryMessageComponentsProps) {
  const auctionList = auctionLots
    .map(
      (lot, index) =>
        `**Lot ${index + 1} | ${lot.title}**\n[Jump to lot →](https://discord.com/channels/${channel.guild.id}/${channel.id}/${lot.messageId ?? ''})${index < auctionLots.length - 1 ? '\n' : ''}`,
    )
    .join('');
  return new ContainerBuilder()
    .addTextDisplayComponents((text) => text.setContent(`### Auction Summary ${Constants.EMOTES.COIN}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `**Auction Ends <t:${Math.round(endDate.getTime() / 1000)}:R>**\nGet your bids in before <t:${Math.round(endDate.getTime() / 1000)}:f> (your local time) ⏰\n\n${auctionList}`,
      ),
    )
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((text) => text.setContent(`**Auction Posted <t:${Math.round(Date.now() / 1000)}:R>**`));
}

export function TimestampHelperMessageComponents(date: Date) {
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
  return new ContainerBuilder()
    .addTextDisplayComponents((text) => text.setContent(`### Timestamp Helper`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(allFormats.map((format) => `\`${format}\`: ${format}`).join('\n\n')));
}

export function InfoCenterMessageComponents() {
  return new ContainerBuilder().setAccentColor(Constants.EMBED_COLOR).addSectionComponents((section) =>
    section
      .addTextDisplayComponents((text) => text.setContent(`### [AHC Info Center](${Constants.INFO_CENTER_LINK})`))
      .addTextDisplayComponents((text) =>
        text.setContent(
          `Click the buttons below to navigate the AHC Info Center right here within Discord (or click "AHC Info Center" above to open the full info center in your web browser!)\n\nThe AHC Info Center is typically updated at least once daily, but may not always show real-time data.`,
        ),
      )
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(Constants.EMBED_AUTHOR_ICON).setDescription('AHC Info Center')),
  );
}

export function TopSellersMessageComponents(topSellers: Collection<string, number>) {
  let topSellerString = '';
  topSellers.forEach((amount, sellerName) => {
    topSellerString += `${Constants.EMOTES.LIST_ITEM} ${sellerName} (${amount.toLocaleString('en-US')})\n`;
  });
  return new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) => text.setContent(`# ${Constants.EMOTES.AHC_BANNER} Top Sellers\n\n${topSellerString}`))
        .setThumbnailAccessory((thumbnail) => thumbnail.setURL(Constants.TOP_SELLER_THUMBNAIL).setDescription('Top Sellers')),
    );
}

export function MemberStatusMessageComponents(member: AhfGuildMemberSheetData) {
  // Get raffle status keys as they are dynamic
  const vinnyRaffleKey = Object.keys(member).find((key) => key.startsWith('Vinny Raffle Tickets')) || 'Vinny Raffle Tickets';
  const bonusRaffleKey = Object.keys(member).find((key) => key.startsWith('Vinny Bonus Tickets')) || 'Vinny Bonus Tickets';
  return new ContainerBuilder().setAccentColor(Constants.EMBED_COLOR).addSectionComponents((section) =>
    section
      .addTextDisplayComponents((text) => text.setContent(`### Your AHC Status`))
      .addTextDisplayComponents((text) => text.setContent(`Hello ${member.Who}! Check your AHC Status below!`))
      .addTextDisplayComponents((text) =>
        text.setContent(
          `**User ID**: ${member.Who}\n**Sales**: ${member.Sales.toLocaleString('en-US')}\n**Requirements Met**: ${member.Safe ? `${Constants.EMOTES.CHECK} Yes` : `${Constants.EMOTES.CANCEL} No`}\n**Vinny Raffle Tickets**: ${Number(member[vinnyRaffleKey] || 0).toLocaleString('en-US')}\n**Gold Raffle Tickets**: ${Number(member[bonusRaffleKey] || 0).toLocaleString('en-US')}\n**Mat Raffle Tickets**: ${(member['Mat Raffle Tickets'] || 0).toLocaleString('en-US')}`,
        ),
      )
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(Constants.AHC_BANNER_IMAGE).setDescription('AHC Banner')),
  );
}

export function ReminderMessageComponents(reminder: ReminderRow) {
  const createdAt = new Date(reminder.created_at * 1000);
  const formattedDate = createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return new ContainerBuilder()
    .addTextDisplayComponents((text) => text.setContent(`### ⏰ Reminder`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(reminder.message))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(`**Created At**: ${formattedDate}`));
}
