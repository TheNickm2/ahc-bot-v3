// Row types - what comes back from SELECT queries
export interface AuctionRow {
  id: string;
  end_time: number;
  channel_id: string;
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
}

export interface ReminderInsert {
  user_id: string;
  channel_id: string;
  message: string;
  remind_at: number;
  auction_id?: string;
}
