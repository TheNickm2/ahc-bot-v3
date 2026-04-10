import Database from 'better-sqlite3';
import fs from 'fs';
import type {
  AuctionInsert,
  AuctionLotInsert,
  AuctionLotRow,
  AuctionRow,
  BidInsert,
  BidRow,
  LotWinnerRow,
  ReminderInsert,
  ReminderRow,
} from '../types/database';

export class DatabaseManager {
  private db: Database.Database;
  private statements = {
    insertAuction: null as Database.Statement<AuctionInsert> | null,
    getAuction: null as Database.Statement<[string]> | null,
    deleteAuction: null as Database.Statement<[string]> | null,
    insertReminder: null as Database.Statement<[string, string, string, number, string | null]> | null,
    getReminder: null as Database.Statement<[number]> | null,
    getUserReminders: null as Database.Statement<[string]> | null,
    deleteReminder: null as Database.Statement<[number]> | null,
    getAllPendingReminders: null as Database.Statement<[number]> | null,
    insertAuctionLot: null as Database.Statement<AuctionLotInsert> | null,
    updateAuctionLotMessageId: null as Database.Statement<[string, number]> | null,
    getAuctionLot: null as Database.Statement<[number]> | null,
    getAuctionLots: null as Database.Statement<[string]> | null,
    insertBid: null as Database.Statement<[number, string, number]> | null,
    getTopBid: null as Database.Statement<[number]> | null,
    getActiveAuction: null as Database.Statement | null,
  };

  constructor() {
    const db = new Database('app.db');
    const initSql = fs.readFileSync(`${process.cwd()}/src/db/schema.sql`, 'utf-8');
    db.exec(initSql);
    this.db = db;
    try {
      this.db.exec('ALTER TABLE auctions ADD COLUMN is_test INTEGER DEFAULT 0');
    } catch {
      // Column already exists on databases created before this migration
    }
    try {
      this.db.exec('ALTER TABLE auction_lots ADD COLUMN description TEXT');
      this.db.exec('ALTER TABLE auction_lots ADD COLUMN image TEXT');
    } catch {
      // Columns already exist
    }
    this.prepareStatements();
  }

  private prepareStatements() {
    this.statements.insertAuction = this.db.prepare<AuctionInsert>(
      'INSERT INTO auctions (id, end_time, channel_id, is_test) VALUES (@id, @end_time, @channel_id, @is_test)',
    );
    this.statements.getAuction = this.db.prepare<[string]>('SELECT * FROM auctions WHERE id = ?');
    this.statements.deleteAuction = this.db.prepare<[string]>('DELETE FROM auctions WHERE id = ?');
    this.statements.insertReminder = this.db.prepare<[string, string, string, number, string | null]>(
      'INSERT INTO reminders (user_id, channel_id, message, remind_at, auction_id) VALUES (?, ?, ?, ?, ?)',
    );
    this.statements.getReminder = this.db.prepare<[number]>('SELECT * FROM reminders WHERE id = ?');
    this.statements.getUserReminders = this.db.prepare<[string]>('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC');
    this.statements.deleteReminder = this.db.prepare<[number]>('DELETE FROM reminders WHERE id = ?');
    this.statements.getAllPendingReminders = this.db.prepare<[number]>('SELECT * FROM reminders WHERE remind_at > ? ORDER BY remind_at ASC');
    this.statements.insertAuctionLot = this.db.prepare<AuctionLotInsert>(
      'INSERT INTO auction_lots (auction_id, message_id, channel_id, lot_number, title, description, image, starting_bid) VALUES (@auction_id, @message_id, @channel_id, @lot_number, @title, @description, @image, @starting_bid)',
    );
    this.statements.updateAuctionLotMessageId = this.db.prepare<[string, number]>('UPDATE auction_lots SET message_id = ? WHERE id = ?');
    this.statements.getAuctionLot = this.db.prepare<[number]>('SELECT * FROM auction_lots WHERE id = ?');
    this.statements.getAuctionLots = this.db.prepare<[string]>('SELECT * FROM auction_lots WHERE auction_id = ? ORDER BY lot_number ASC');
    this.statements.insertBid = this.db.prepare<[number, string, number]>('INSERT INTO bids (lot_id, user_id, amount) VALUES (?, ?, ?)');
    this.statements.getTopBid = this.db.prepare<[number]>('SELECT * FROM bids WHERE lot_id = ? ORDER BY amount DESC LIMIT 1');
    this.statements.getActiveAuction = this.db.prepare("SELECT * FROM auctions WHERE end_time > strftime('%s', 'now') LIMIT 1");
  }

  // Auction methods
  public insertAuction(data: AuctionInsert): void {
    this.statements.insertAuction!.run(data);
  }

  public getAuction(id: string): AuctionRow | undefined {
    return this.statements.getAuction!.get(id) as AuctionRow | undefined;
  }

  public deleteAuction(id: string): void {
    this.statements.deleteAuction!.run(id);
  }

  // Reminder methods
  public insertReminder(data: ReminderInsert): Database.RunResult {
    return this.statements.insertReminder!.run(data.user_id, data.channel_id, data.message, data.remind_at, data.auction_id ?? null);
  }

  public getReminder(id: number): ReminderRow | undefined {
    return this.statements.getReminder!.get(id) as ReminderRow | undefined;
  }

  public getUserReminders(userId: string): ReminderRow[] {
    return this.statements.getUserReminders!.all(userId) as ReminderRow[];
  }

  public deleteReminder(id: number): void {
    this.statements.deleteReminder!.run(id);
  }

  public getAllPendingReminders(): ReminderRow[] {
    const now = Math.floor(Date.now() / 1000);
    return this.statements.getAllPendingReminders!.all(now) as ReminderRow[];
  }

  public getAuctionReminders(auctionId: string): ReminderRow[] {
    const statement = this.db.prepare<[string]>('SELECT * FROM reminders WHERE auction_id = ? ORDER BY remind_at ASC');
    return statement.all(auctionId) as ReminderRow[];
  }

  public deletePastReminders(): void {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare('DELETE FROM reminders WHERE remind_at < ?').run(now);
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public getActiveAuction(): AuctionRow | undefined {
    return this.statements.getActiveAuction!.get() as AuctionRow | undefined;
  }

  // Auction lot methods
  public insertAuctionLot(data: AuctionLotInsert): number {
    const result = this.statements.insertAuctionLot!.run(data);
    return Number(result.lastInsertRowid);
  }

  public updateAuctionLotMessageId(lotId: number, messageId: string): void {
    this.statements.updateAuctionLotMessageId!.run(messageId, lotId);
  }

  public getAuctionLot(id: number): AuctionLotRow | undefined {
    return this.statements.getAuctionLot!.get(id) as AuctionLotRow | undefined;
  }

  public getAuctionLots(auctionId: string): AuctionLotRow[] {
    return this.statements.getAuctionLots!.all(auctionId) as AuctionLotRow[];
  }

  // Bid methods
  public insertBid(data: BidInsert): Database.RunResult | null {
    return this.db.transaction(() => {
      const currentTop = this.getTopBid(data.lot_id);
      if (currentTop && data.amount <= currentTop.amount!) {
        return null;
      }
      return this.statements.insertBid!.run(data.lot_id, data.user_id, data.amount);
    })();
  }

  public getTopBid(lotId: number): BidRow | undefined {
    return this.statements.getTopBid!.get(lotId) as BidRow | undefined;
  }

  public getWinnersForAuction(auctionId: string): LotWinnerRow[] {
    const statement = this.db.prepare<[string]>(`
      SELECT al.*, b.user_id AS winner_user_id, b.amount AS winning_amount
      FROM auction_lots al
      LEFT JOIN bids b ON b.id = (
        SELECT id FROM bids WHERE lot_id = al.id ORDER BY amount DESC LIMIT 1
      )
      WHERE al.auction_id = ?
      ORDER BY al.lot_number ASC
    `);
    return statement.all(auctionId) as LotWinnerRow[];
  }

  public getAuctionReminderForUser(auctionId: string, userId: string, offsetSeconds: number): ReminderRow | undefined {
    const statement = this.db.prepare<[string, string, number]>(`
      SELECT r.*
      FROM reminders r
      JOIN auctions a ON a.id = r.auction_id
      WHERE r.auction_id = ? AND r.user_id = ? AND r.remind_at = a.end_time - ?
    `);
    return statement.get(auctionId, userId, offsetSeconds) as ReminderRow | undefined;
  }
}
