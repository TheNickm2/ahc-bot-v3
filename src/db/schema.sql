CREATE TABLE IF NOT EXISTS auctions (
  id TEXT PRIMARY KEY,              -- interaction.id or message.id
  end_time INTEGER NOT NULL,        -- Unix timestamp
  channel_id TEXT NOT NULL,
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
