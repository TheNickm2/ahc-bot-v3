// Row types - what comes back from SELECT queries
export interface AuctionRow {
  id: string;
  end_time: number;
  channel_id: string;
  is_test: number;
  created_at: number;
}

export interface ReminderRow {
  id: number;
  user_id: string;
  channel_id: string;
  message: string;
  remind_at: number;
  auction_id?: string;
  created_at: number;
}

// Insert types - what you pass to INSERT statements (omit auto-generated fields)
export interface AuctionInsert {
  id: string;
  end_time: number;
  channel_id: string;
  is_test: number;
}

export interface ReminderInsert {
  user_id: string;
  channel_id: string;
  message: string;
  remind_at: number;
  auction_id?: string;
}

// Row types for new auction bidding tables
export interface AuctionLotRow {
  id: number;
  auction_id: string;
  message_id: string | null;
  channel_id: string | null;
  lot_number: number | null;
  title: string | null;
  description: string | null;
  image: string | null;
  starting_bid: number | null;
}

export interface AuctionLotInsert {
  auction_id: string;
  message_id: string | null;
  channel_id: string | null;
  lot_number: number | null;
  title: string | null;
  description: string | null;
  image: string | null;
  starting_bid: number | null;
}

export interface BidRow {
  id: number;
  lot_id: number;
  user_id: string | null;
  amount: number | null;
  created_at: number;
}

export interface BidInsert {
  lot_id: number;
  user_id: string;
  amount: number;
}

export interface LotWinnerRow extends AuctionLotRow {
  winner_user_id: string | null;
  winning_amount: number | null;
}
