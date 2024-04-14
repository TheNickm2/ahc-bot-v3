import type { GoogleSpreadsheetRow } from "google-spreadsheet";

export interface AuctionLotRow extends GoogleSpreadsheetRow {
  Title: string;
  Description: string;
  Image?: string;
  "Starting Bid": string;
}

export interface AuctionLot {
  title: string;
  description: string;
  image?: string;
  startingBid: number;
}
