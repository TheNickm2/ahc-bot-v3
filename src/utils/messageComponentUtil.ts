import type { Collection, GuildTextBasedChannel } from 'discord.js';
import { ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorSpacingSize } from 'discord.js';
import type { AuctionLot } from '../types/auction';
import { Constants } from '../config/constants';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
import type { AuctionLotRow, AuctionRow, BidRow, LotWinnerRow, ReminderRow } from '../types/database';

export interface AuctionLotMessageComponentsProps {
  lotInfo: AuctionLot;
  lotNumber: number;
  lotId?: number;
}
export function AuctionLotMessageComponents({ lotInfo, lotNumber, lotId }: AuctionLotMessageComponentsProps) {
  if (!lotInfo || !lotNumber) {
    throw new Error('Missing required props for AuctionLotMessageComponents');
  }
  const container = new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Lot ${lotNumber}: ${lotInfo.title}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(lotInfo.description))
    .addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(`**Starting Bid**\n${Constants.EMOTES.COIN} ${lotInfo.startingBid.toLocaleString('en-us')}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large));
  if (lotInfo.image) {
    container.addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(lotInfo.image!).setDescription(`Image for Lot ${lotNumber} - ${lotInfo.title}`)),
    );
    container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  }
  if (lotId !== undefined) {
    container.addTextDisplayComponents((text) => text.setContent('Place a bid using the buttons below:'));
    container.addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lotId}:10000`).setLabel('+10k Bid').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lotId}:25000`).setLabel('+25k Bid').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lotId}:100000`).setLabel('+100k Bid').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_CUSTOM}:${lotId}`).setLabel('Custom Bid').setStyle(ButtonStyle.Primary),
      ),
    );
  }
  return container;
}

export interface AuctionSummaryMessageComponentsProps {
  auctionLots: Array<AuctionLot & { messageId: string }>;
  endDate: Date;
  channel: GuildTextBasedChannel;
  auctionId: string;
  isTest: boolean;
}
export function AuctionSummaryMessageComponents({ auctionLots, endDate, channel, auctionId, isTest }: AuctionSummaryMessageComponentsProps) {
  const auctionList = auctionLots
    .map(
      (lot, index) =>
        `**Lot ${index + 1} | ${lot.title}**\n[Jump to lot →](https://discord.com/channels/${channel.guild.id}/${channel.id}/${lot.messageId ?? ''})${index < auctionLots.length - 1 ? '\n' : ''}`,
    )
    .join('');
  const container = new ContainerBuilder()
    .addTextDisplayComponents((text) => text.setContent(`### Auction Summary ${Constants.EMOTES.COIN}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `**Auction Ends <t:${Math.round(endDate.getTime() / 1000)}:R>**\nGet your bids in before <t:${Math.round(endDate.getTime() / 1000)}:f> (your local time) ⏰\n\n${auctionList}`,
      ),
    )
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((text) => text.setContent(`**Auction Posted <t:${Math.round(Date.now() / 1000)}:R>**`));
  if (!isTest) {
    container.addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.AUCTION_REMIND}:${auctionId}`)
          .setLabel('🔔 Remind Me')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.OUTBID_NOTIFY}:${auctionId}`)
          .setLabel('💸 Outbid Alerts')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }
  return container;
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

export interface AuctionLotWithBidComponentsProps {
  lot: AuctionLotRow;
  lotNumber: number;
  topBid?: BidRow;
}
export function AuctionLotWithBidComponents({ lot, lotNumber, topBid }: AuctionLotWithBidComponentsProps) {
  const bidStatusText = topBid
    ? `**Current Bid:** ${Constants.EMOTES.COIN} ${topBid.amount!.toLocaleString('en-us')} by <@${topBid.user_id}>`
    : `**Starting Bid:** ${Constants.EMOTES.COIN} ${lot.starting_bid!.toLocaleString('en-us')} — No bids yet`;
  const container = new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Lot ${lotNumber}: ${lot.title}`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(lot.description ?? ''))
    .addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(bidStatusText))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large));
  if (lot.image) {
    container.addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(lot.image!).setDescription(`Image for Lot ${lotNumber} - ${lot.title}`)),
    );
    container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  }
  container.addTextDisplayComponents((text) => text.setContent('Place a bid using the buttons below:'));
  container.addActionRowComponents((row) =>
    row.addComponents(
      new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lot.id}:10000`).setLabel('+10k').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lot.id}:25000`).setLabel('+25k').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_QUICK}:${lot.id}:100000`).setLabel('+100k').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_CUSTOM}:${lot.id}`).setLabel('Custom Bid').setStyle(ButtonStyle.Primary),
    ),
  );
  return container;
}

export interface BidLogComponentsProps {
  bid: BidRow;
  lot: AuctionLotRow;
  includeUndo?: boolean;
  note?: string;
}
export function BidLogComponents({ bid, lot, includeUndo = true, note }: BidLogComponentsProps) {
  const container = new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Bid Logged`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `**Bidder:** <@${bid.user_id}>\n**Bid Amount:** ${Constants.EMOTES.COIN} ${bid.amount!.toLocaleString('en-us')}\n**Lot:** ${lot.title}\n**Lot ID:** ${lot.id}\n**Timestamp:** <t:${bid.created_at}:F>`,
      ),
    );

  if (note) {
    container
      .addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents((text) => text.setContent(note));
  }

  if (includeUndo) {
    container
      .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
      .addActionRowComponents((row) =>
        row.addComponents(
          new ButtonBuilder().setCustomId(`${Constants.BUTTON_IDS.BID_UNDO}:${bid.id}`).setLabel('Undo').setStyle(ButtonStyle.Danger),
        ),
      );
  }

  return container;
}

export interface RevertedBidLogComponentsProps {
  bid: BidRow;
  lot: AuctionLotRow;
}
export function RevertedBidLogComponents({ bid, lot }: RevertedBidLogComponentsProps) {
  return BidLogComponents({
    bid,
    lot,
    includeUndo: false,
    note: `**Reverted:** <t:${bid.reverted_at}:F> by <@${bid.reverted_by}>\n**Reason:** ${bid.revert_reason}`,
  });
}

export interface AuctionReminderOptInComponentsProps {
  auctionId: string;
  auctionEndTime: number;
  states: {
    day: boolean;
    hour: boolean;
    min: boolean;
  };
}
export function AuctionReminderOptInComponents({ auctionId, auctionEndTime, states }: AuctionReminderOptInComponentsProps) {
  const now = Math.floor(Date.now() / 1000);
  const dayDisabled = auctionEndTime - 86400 <= now;
  const hourDisabled = auctionEndTime - 3600 <= now;
  const minDisabled = auctionEndTime - 900 <= now;
  return new ContainerBuilder()
    .addTextDisplayComponents((text) =>
      text.setContent(
        `### 🔔 Auction Reminders\nThis auction ends <t:${auctionEndTime}:F> (<t:${auctionEndTime}:R>).\nToggle reminders below. You'll receive a DM before the auction ends.`,
      ),
    )
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.AUCTION_REMIND_TOGGLE}:${auctionId}:86400`)
          .setLabel(states.day ? '✅ 24h Before' : '24h Before')
          .setStyle(states.day ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(dayDisabled),
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.AUCTION_REMIND_TOGGLE}:${auctionId}:3600`)
          .setLabel(states.hour ? '✅ 1h Before' : '1h Before')
          .setStyle(states.hour ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(hourDisabled),
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.AUCTION_REMIND_TOGGLE}:${auctionId}:900`)
          .setLabel(states.min ? '✅ 15min Before' : '15min Before')
          .setStyle(states.min ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(minDisabled),
      ),
    );
}

export function AuctionLotEndedComponents({ lot }: { lot: LotWinnerRow }) {
  const resultText =
    lot.winner_user_id && lot.winning_amount != null
      ? `**Winner:** <@${lot.winner_user_id}> | **Winning Bid:** ${Constants.EMOTES.COIN} ${lot.winning_amount.toLocaleString('en-us')}`
      : '**No winner — no bids were placed**';
  const container = new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Lot ${lot.lot_number}: ${lot.title} — ENDED`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(lot.description ?? ''))
    .addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(resultText))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large));
  if (lot.image) {
    container.addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(lot.image!).setDescription(`Image for Lot ${lot.lot_number} - ${lot.title}`)),
    );
  }
  return container;
}

export function WinnerDMMessageComponents(wonLots: LotWinnerRow[]) {
  const lotsList = wonLots
    .map(
      (lot) =>
        `${Constants.EMOTES.LIST_ITEM} **Lot ${lot.lot_number}: ${lot.title}** — ${Constants.EMOTES.COIN} ${lot.winning_amount!.toLocaleString('en-us')}`,
    )
    .join('\n');
  return new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### 🎉 You won an auction lot!`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `You won the following lot(s):\n\n${lotsList}\n\nPlease deposit ${wonLots.reduce((total, lot) => total + lot.winning_amount!, 0).toLocaleString('en-us')}g to the AHC guild bank at your earliest convenience. Lots will be mailed to you within 72 hours of payment. Thank you for participating in the auction!`,
      ),
    );
}

export interface OutbidNotifyComponentsProps {
  auctionId: string;
  isSubscribed: boolean;
}
export function OutbidNotifyComponents({ auctionId, isSubscribed }: OutbidNotifyComponentsProps) {
  return new ContainerBuilder()
    .addTextDisplayComponents((text) =>
      text.setContent(
        `### 💸 Outbid Alerts\nIf you're the leading bidder on a lot and someone outbids you, you'll receive a DM with a link directly to the lot.\n\nCurrent status: **${isSubscribed ? 'Enabled ✅' : 'Disabled'}**`,
      ),
    )
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${Constants.BUTTON_IDS.OUTBID_NOTIFY_TOGGLE}:${auctionId}`)
          .setLabel(isSubscribed ? '✅ Alerts On — Click to Disable' : 'Alerts Off — Click to Enable')
          .setStyle(isSubscribed ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    );
}

export interface OutbidDMComponentsProps {
  lot: AuctionLotRow;
  auction: AuctionRow;
  newAmount: number;
  guildId: string;
}
export function OutbidDMComponents({ lot, auction, newAmount, guildId }: OutbidDMComponentsProps) {
  const lotUrl = `https://discord.com/channels/${guildId}/${lot.channel_id}/${lot.message_id}`;
  return new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### 🔔 You've been outbid!`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `You were outbid on **Lot ${lot.lot_number}: ${lot.title}**!\nNew top bid: ${Constants.EMOTES.COIN} **${newAmount.toLocaleString('en-us')}** — [Jump to lot →](${lotUrl})\n\nYou have <t:${Math.floor(auction.end_time)}:R> to place a new bid before the auction ends!`,
      ),
    );
}

/** Formats a raw gold amount into compact notation: 650 → "650", 165000 → "165k", 2400000 → "2.4m" */
function formatBidAmount(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `${m % 1 === 0 ? m : parseFloat(m.toFixed(1))}m`;
  }
  if (amount >= 1_000) {
    const k = amount / 1_000;
    return `${k % 1 === 0 ? k : parseFloat(k.toFixed(1))}k`;
  }
  return amount.toLocaleString('en-us');
}

export interface OfficerAuctionRecapComponentsProps {
  winners: LotWinnerRow[];
  /** Maps winner user_id → whether their DM was delivered successfully */
  dmResults: Map<string, boolean>;
  isTest: boolean;
  auctionEndTime: number;
}
export function OfficerAuctionRecapComponents({ winners, dmResults, isTest, auctionEndTime }: OfficerAuctionRecapComponentsProps) {
  const lotLines = winners
    .map((lot) => {
      const lotLabel = `**Lot ${lot.lot_number}: ${lot.title}**`;
      if (!lot.winner_user_id || lot.winning_amount == null) {
        return `\`${String(lot.lot_number!).padStart(2, ' ')}.\` ${lotLabel} — *No bids placed*`;
      }
      const bidStr = formatBidAmount(lot.winning_amount);
      let dmStatus: string;
      if (isTest) {
        dmStatus = '*(test — DM suppressed)*';
      } else {
        dmStatus = dmResults.get(lot.winner_user_id) ? '✅ DM sent' : '⚠️ DM failed';
      }
      return `\`${String(lot.lot_number!).padStart(2, ' ')}.\` ${lotLabel} — <@${lot.winner_user_id}> — ${bidStr} — ${dmStatus}`;
    })
    .join('\n');

  const grandTotal = winners.reduce((sum, lot) => sum + (lot.winning_amount ?? 0), 0);
  const grandTotalStr = formatBidAmount(grandTotal);

  const container = new ContainerBuilder()
    .setAccentColor(Constants.EMBED_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`### Auction Winner Log${isTest ? ' *(test run)*' : ''}\nEnded <t:${auctionEndTime}:F>`))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(lotLines))
    .addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(`💰 **Grand Total: ${grandTotalStr}**`));

  return container;
}
