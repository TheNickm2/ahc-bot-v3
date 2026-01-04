import Database from 'better-sqlite3';
import fs from 'fs';
import type { AuctionInsert, AuctionRow, ReminderInsert, ReminderRow } from '../types/database';

export class DatabaseManager {
  private db: Database.Database;
  private stmts = {
    insertAuction: null as Database.Statement<AuctionInsert> | null,
    getAuction: null as Database.Statement<[string]> | null,
    deleteAuction: null as Database.Statement<[string]> | null,
    insertReminder: null as Database.Statement<[string, string, string, number, string | null]> | null,
    getReminder: null as Database.Statement<[number]> | null,
    getUserReminders: null as Database.Statement<[string]> | null,
    deleteReminder: null as Database.Statement<[number]> | null,
    getAllPendingReminders: null as Database.Statement<[number]> | null,
  };

  constructor() {
    const db = new Database('app.db');
    const initSql = fs.readFileSync(`${process.cwd()}/src/db/schema.sql`, 'utf-8');
    db.exec(initSql);
    this.db = db;
    this.prepareStatements();
  }

  private prepareStatements() {
    this.stmts.insertAuction = this.db.prepare<AuctionInsert>('INSERT INTO auctions (id, end_time, channel_id) VALUES (@id, @end_time, @channel_id)');
    this.stmts.getAuction = this.db.prepare<[string]>('SELECT * FROM auctions WHERE id = ?');
    this.stmts.deleteAuction = this.db.prepare<[string]>('DELETE FROM auctions WHERE id = ?');
    this.stmts.insertReminder = this.db.prepare<[string, string, string, number, string | null]>(
      'INSERT INTO reminders (user_id, channel_id, message, remind_at, auction_id) VALUES (?, ?, ?, ?, ?)',
    );
    this.stmts.getReminder = this.db.prepare<[number]>('SELECT * FROM reminders WHERE id = ?');
    this.stmts.getUserReminders = this.db.prepare<[string]>('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC');
    this.stmts.deleteReminder = this.db.prepare<[number]>('DELETE FROM reminders WHERE id = ?');
    this.stmts.getAllPendingReminders = this.db.prepare<[number]>('SELECT * FROM reminders WHERE remind_at > ? ORDER BY remind_at ASC');
  }

  // Auction methods
  public insertAuction(data: AuctionInsert): void {
    this.stmts.insertAuction!.run(data);
  }

  public getAuction(id: string): AuctionRow | undefined {
    return this.stmts.getAuction!.get(id) as AuctionRow | undefined;
  }

  public deleteAuction(id: string): void {
    this.stmts.deleteAuction!.run(id);
  }

  // Reminder methods
  public insertReminder(data: ReminderInsert): Database.RunResult {
    return this.stmts.insertReminder!.run(data.user_id, data.channel_id, data.message, data.remind_at, data.auction_id ?? null);
  }

  public getReminder(id: number): ReminderRow | undefined {
    return this.stmts.getReminder!.get(id) as ReminderRow | undefined;
  }

  public getUserReminders(userId: string): ReminderRow[] {
    return this.stmts.getUserReminders!.all(userId) as ReminderRow[];
  }

  public deleteReminder(id: number): void {
    this.stmts.deleteReminder!.run(id);
  }

  public getAllPendingReminders(): ReminderRow[] {
    const now = Math.floor(Date.now() / 1000);
    return this.stmts.getAllPendingReminders!.all(now) as ReminderRow[];
  }

  public getAuctionReminders(auctionId: string): ReminderRow[] {
    const stmt = this.db.prepare<[string]>('SELECT * FROM reminders WHERE auction_id = ? ORDER BY remind_at ASC');
    return stmt.all(auctionId) as ReminderRow[];
  }

  public deletePastReminders(): void {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare('DELETE FROM reminders WHERE remind_at < ?').run(now);
  }

  public getDatabase(): Database.Database {
    return this.db;
  }
}
