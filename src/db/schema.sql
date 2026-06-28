CREATE TABLE IF NOT EXISTS auctions (
  id TEXT PRIMARY KEY,              -- interaction.id or message.id
  end_time INTEGER NOT NULL,        -- Unix timestamp
  channel_id TEXT NOT NULL,
  is_test INTEGER DEFAULT 0,        -- 1 if this is a test auction
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message TEXT NOT NULL,            -- User's reminder message
  remind_at INTEGER NOT NULL,       -- Unix timestamp
  auction_id TEXT,                  -- NULL for custom reminders, references auctions.id
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_auctions_end ON auctions(end_time);

CREATE TABLE IF NOT EXISTS auction_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_id TEXT NOT NULL,
  message_id TEXT,
  channel_id TEXT,
  lot_number INTEGER,
  title TEXT,
  description TEXT,
  image TEXT,
  starting_bid INTEGER,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lot_id INTEGER NOT NULL,
  user_id TEXT,
  amount INTEGER,
  reverted_at INTEGER,
  reverted_by TEXT,
  revert_reason TEXT,
  bid_log_channel_id TEXT,
  bid_log_message_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auction_lots_auction ON auction_lots(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_lot ON bids(lot_id);

CREATE TABLE IF NOT EXISTS outbid_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  UNIQUE(auction_id, user_id),
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outbid_subs_auction ON outbid_subscriptions(auction_id);
