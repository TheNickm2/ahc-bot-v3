import type { AuctionLot, AuctionLotRow } from '../types/auction';
import { container } from '@sapphire/framework';
import { GoogleSpreadsheetUtil } from './googleSpreadsheetUtil';
import numeral from 'numeral';

export class AuctionLotHelper {
	private readonly googleSpreadsheetUtil: GoogleSpreadsheetUtil;
	private auctionLots: AuctionLot[] = [];

	constructor() {
		if (!process.env.DISCORD_AUCTION_SHEET_ID) {
			throw new Error('Environment Configuration Error. Discord Auction Sheet ID is required');
		}
		this.googleSpreadsheetUtil = new GoogleSpreadsheetUtil(process.env.DISCORD_AUCTION_SHEET_ID);
	}

	private async loadAuctionLots() {
		this.auctionLots = [];
		const sheet = await this.googleSpreadsheetUtil.getSheet({
			title: 'Discord Auction Lots',
		});
		if (!sheet) {
			container.logger.warn('Sheet "Discord Auction Lots" not found');
			return;
		}
		await sheet.loadCells('A2:D100');
		const rows = await sheet.getRows<AuctionLotRow>();
		rows.forEach((row) => {
			const rowData = {
				Title: row.get('Title'),
				Description: row.get('Description'),
				Image: row.get('Image'),
				'Starting Bid': row.get('Starting Bid'),
			} as AuctionLotRow;
			const startingBid = numeral(rowData['Starting Bid']!).value() || 0;
			if (!rowData.Title || !rowData.Description || !rowData['Starting Bid'] || Number.isNaN(startingBid) || startingBid <= 0) return;
			this.auctionLots.push({
				title: rowData.Title,
				description: rowData.Description,
				image: rowData.Image,
				startingBid: startingBid,
			});
		});
	}

	public async getAuctionLots() {
		try {
			await this.loadAuctionLots();
		} catch (err) {
			container.logger.error(err);
		}
		return this.auctionLots;
	}
}
