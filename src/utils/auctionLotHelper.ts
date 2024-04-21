import type { AuctionLot, AuctionLotRow } from '../types/auction';
import { container } from '@sapphire/framework';
import { GoogleSpreadsheetUtil } from './googleSpreadsheetUtil';

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
		const sheet = await this.googleSpreadsheetUtil.getSheet(undefined, 'Discord Auction Lots');
		if (!sheet) {
			container.logger.warn('Sheet "Discord Auction Lots" not found');
			return;
		}
		await sheet.loadCells('A2:D100');
		const rows = await sheet.getRows();
		rows.forEach((row) => {
			const rowData = row as AuctionLotRow;
			if (!rowData.Title || !rowData.Description || !rowData['Starting Bid'] || Number.isNaN(rowData['Starting Bid'])) return;
			this.auctionLots.push({
				title: rowData.Title,
				description: rowData.Description,
				image: rowData.Image,
				startingBid: Number(rowData['Starting Bid']),
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
