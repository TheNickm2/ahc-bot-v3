# Auction Overhaul — Implementation Notes

Branch: `feature/auction-overhaul` vs `main`  
Implemented: April 2026  
Build status: `npx tsc --noEmit` → Exit 0 (no errors)

---

## Overview

The old auction system posted lot messages without interaction and created threads per lot. This overhaul replaces it entirely with:

- Button-based bidding directly from the auction channel
- Live lot message updates reflecting the current top bid after every placed bid
- A race-safe SQLite transaction wrapping every bid insert
- A "Remind Me" opt-in system with per-auction toggle reminders delivered via DM
- An `AuctionEndScheduler` that auto-closes lots, edits messages to their ended state, and DMs winners
- Full persistence (SQLite) and restart rehydration for both the reminder scheduler and the auction end scheduler
- An `is-test` flag on the `/auction` command for officer testing — suppresses winner DMs and marks the auction in DB; all buttons still work normally

---

## File Inventory

### New files
| File | Purpose |
|------|---------|
| `src/interaction-handlers/quickBid.ts` | `+100k Bid` button handler |
| `src/interaction-handlers/customBid.ts` | `Custom Bid` button handler — shows modal |
| `src/interaction-handlers/customBidModal.ts` | Modal submit handler — validates and shows confirm UI |
| `src/interaction-handlers/customBidConfirm.ts` | Confirm + cancel button handler (both in one file) |
| `src/interaction-handlers/auctionReminderOptIn.ts` | `🔔 Remind Me` button — sends DM toggle UI |
| `src/interaction-handlers/auctionReminderToggle.ts` | Per-offset reminder toggle buttons |
| `src/utils/auctionEndScheduler.ts` | node-schedule wrapper for auction end lifecycle |

### Modified files
| File | Key changes |
|------|------------|
| `src/commands/auction.ts` | Added `is-test` boolean option; stores `{ endDate, isTest }` in `AuctionEndDates` |
| `src/interaction-handlers/startAuction.ts` | Full overhaul — DB inserts, no thread creation, bid buttons per lot, Remind Me on summary, schedules auction end |
| `src/state/state.ts` | Added `AuctionEndScheduler` export; `AuctionEndDates` type updated to `{ endDate, isTest }` |
| `src/db/schema.sql` | Added `auction_lots` and `bids` tables; `is_test` column on `auctions` |
| `src/types/database.ts` | Added `AuctionLotRow`, `AuctionLotInsert`, `BidRow`, `BidInsert`, `LotWinnerRow`; `is_test` on `AuctionRow`/`AuctionInsert` |
| `src/utils/databaseManager.ts` | All new auction lot/bid methods; `getActiveAuction()`; runtime `ALTER TABLE` migrations for `is_test`, `description`, `image` |
| `src/utils/messageComponentUtil.ts` | Added 5 new component builder functions; updated `AuctionLotMessageComponents` and `AuctionSummaryMessageComponents` |
| `src/config/constants.ts` | Added `BID_QUICK`, `BID_CUSTOM`, `BID_CONFIRM`, `BID_CANCEL`, `AUCTION_REMIND`, `AUCTION_REMIND_TOGGLE` to `BUTTON_IDS` |

---

## Database Schema

```sql
-- Added to existing schema.sql
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
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auction_lots_auction ON auction_lots(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_lot ON bids(lot_id);

-- auctions table also has:
-- is_test INTEGER DEFAULT 0  (added via ALTER TABLE migration in DatabaseManager constructor)
```

All FK relationships use `ON DELETE CASCADE`. Deleting an auction cascades to `auction_lots` → `bids` and also to `reminders` (existing FK).

`description` and `image` columns on `auction_lots` were added late — they exist in `schema.sql` but a runtime `ALTER TABLE` migration in the `DatabaseManager` constructor also handles databases that were created before those columns were added.

---

## CustomId Patterns

All button/modal custom IDs are prefix-safe (no ID is a prefix of another):

| Handler | CustomId pattern | Type |
|---------|-----------------|------|
| `quickBid.ts` | `bid-quick:<lotId>` | Button |
| `customBid.ts` | `bid-custom:<lotId>` | Button |
| `customBidModal.ts` | `bid-custom-modal:<lotId>` | ModalSubmit |
| `customBidConfirm.ts` (confirm) | `bid-confirm:<lotId>:<amount>` | Button |
| `customBidConfirm.ts` (cancel) | `bid-cancel` | Button |
| `auctionReminderOptIn.ts` | `auction-remind:<auctionId>` | Button |
| `auctionReminderToggle.ts` | `auction-remind-toggle:<auctionId>:<offsetSeconds>` | Button |

Note: `bid-custom:` and `bid-custom-modal:` differ at position 11 (`:`  vs `-`), so `startsWith` routing does not cross-match.

---

## Interaction Flows

### Starting an auction (officer flow)
1. Officer runs `/auction end:"Next Thursday at 8PM" [timezone] [is-test]`
2. Bot replies ephemerally with the parsed end date and a `Start` button
3. Officer clicks `Start` → `startAuction.ts` runs:
   - Checks for an active auction in DB; if found, cancels its end scheduler job, cancels all reminder jobs for it, then deletes it (cascade wipes lots/bids/reminders)
   - Calls `Database.insertAuction()`
   - For each lot from Google Sheets: `insertAuctionLot()` → sends the lot message with `+100k Bid` and `Custom Bid` buttons → `updateAuctionLotMessageId()`
   - Posts the summary message with jump links; if not a test auction, also adds a `🔔 Remind Me` button
   - Calls `AuctionEndScheduler.scheduleAuctionEnd()`
   - Deletes the deferred reply (silent to channel); sends officer an ephemeral with a timestamp helper

### Quick Bid (`+100k Bid`)
1. User clicks `+100k Bid` on any lot message
2. `quickBid.ts` defers ephemeral
3. Fetches lot + auction from DB; verifies auction is still active
4. Gets current top bid; computes `newAmount = (topBid?.amount ?? lot.starting_bid!) + 100000`
5. Calls `Database.insertBid()` — wrapped in a SQLite transaction that re-reads the current top bid before inserting; returns `null` if a concurrent bid already matched or exceeded `newAmount`
6. If `null` returned: replies with current top bid and asks to try again
7. If inserted: fetches the lot's Discord message and edits it with `AuctionLotWithBidComponents` (shows new top bidder + amount)
8. Replies with "Your bid of X has been placed!"

### Custom Bid (2-step modal flow)
1. User clicks `Custom Bid` → `customBid.ts` shows a modal via `interaction.showModal()`
   - Modal customId: `bid-custom-modal:<lotId>`
   - Modal title: `Bid on Lot N: Title`
   - Contains one `LabelBuilder` wrapping a `TextInputBuilder` with customId `bid_amount`, placeholder `e.g. 50000 or 50k`; label shows current minimum bid
2. User submits modal → `customBidModal.ts`:
   - Parses amount with `numeral(value).value()`
   - Validates: amount > 0, amount % 1000 === 0 (multiple of 1,000g), amount >= topBid + 1,000 (or startingBid)
   - On any validation failure: ephemeral error reply
   - On success: ephemeral reply with `BidConfirmationComponents` — shows parsed amount, lot title, and two buttons: `✅ Confirm Bid` (customId: `bid-confirm:<lotId>:<amount>`) and `❌ Cancel` (customId: `bid-cancel`)
3. User clicks `✅ Confirm Bid` → `customBidConfirm.ts` (action: `'confirm'`):
   - Defers update (edits ephemeral in place)
   - Re-fetches lot + auction; verifies still active
   - Re-validates amount vs current top bid (may have been outbid while modal was open)
   - Calls `Database.insertBid()` (same race-safe transaction)
   - Edits lot message; updates ephemeral to "Bid placed! ✅"
4. User clicks `❌ Cancel` → `customBidConfirm.ts` (action: `'cancel'`):
   - Calls `interaction.update()` with "Bid cancelled." and empty components (no defer needed)

### Remind Me flow
1. User clicks `🔔 Remind Me` on summary message → `auctionReminderOptIn.ts`:
   - Defers reply ephemeral immediately (Discord's 3-second reply window)
   - Fetches auction; verifies active
   - Checks DB for existing reminders at each of the 3 offsets (86400s, 3600s, 900s) for this user + auction
   - Builds `AuctionReminderOptInComponents` with current toggle states and auction end time displayed as Discord timestamps (`:F` + `:R`)
   - Attempts to DM the component to the user
   - **If DM succeeds**: edits ephemeral reply to "Check your DMs! 📬"
   - **If DM fails** (closed DMs): edits ephemeral reply with the toggle UI directly (graceful fallback)
2. User clicks any toggle button → `auctionReminderToggle.ts`:
   - Defers update (edits the message with the buttons in place, works for both DM and ephemeral)
   - Verifies auction still active; checks if reminder time has already passed
   - If already-existing reminder: `ReminderScheduler.cancelReminder(id)` (cancels node-schedule job + deletes from DB)
   - If no existing reminder: `Database.insertReminder()` → `ReminderScheduler.scheduleReminder(newId)`
   - Re-fetches all 3 states; edits message with updated toggle UI (buttons reflect new state)
3. At reminder time: `ReminderScheduleManager.executeReminder()` DMs the user `ReminderMessageComponents`:
   - `### ⏰ Reminder`
   - Message text: `⏰ An auction you are watching is ending in 24 hours!` (or 1 hour / 15 minutes)
   - `**Created At**: [date]`
   - Reminder is one-shot — deleted from DB after successful delivery

**Note on multiple Remind Me clicks**: If a user clicks 🔔 Remind Me multiple times, they get multiple DM messages each with live toggle buttons. The toggle state is always read from the DB on each click, so the actual subscription state is always correct regardless of which DM the user interacts with. Old DM messages may show visually stale button states but do not break functionality. This is treated as user error / acceptable degradation.

### Auction end lifecycle
At `auction.end_time`, `AuctionEndScheduler.executeAuctionEnd()` runs:
1. Cancels all pending `node-schedule` reminder jobs for this auction and deletes them from DB
2. Calls `Database.getWinnersForAuction(auctionId)` — a LEFT JOIN query returning all lots with their top bids
3. For each lot: fetches the original Discord message by `message_id` + `channel_id`; edits it with `AuctionLotEndedComponents` (no buttons; shows winner mention + winning amount, or "No winner" if no bids)
4. Groups winning lots by `winner_user_id`; for each winner (unless `isTest`): DMs `WinnerDMMessageComponents` listing all lots won + amounts + "contact an officer" note; DM failures are logged and skipped gracefully
5. Posts `🏁 **The auction has ended!** Winners have been notified via DM.` in the auction channel (includes `*(test run — no DMs sent)*` suffix if test)

**Restart rehydration**: On bot startup, `AuctionEndScheduler`'s constructor calls `Database.getActiveAuction()` and re-registers the end job if one is found. This mirrors the same pattern used by `ReminderScheduleManager`.

---

## Message Components Reference

All new components in `src/utils/messageComponentUtil.ts`. All use `ContainerBuilder` with `MessageFlags.IsComponentsV2`.

### `AuctionLotMessageComponents({ lotInfo, lotNumber, lotId? })`
Initial lot message (pre-bids). Has `+100k Bid` + `Custom Bid` buttons only if `lotId` is provided. Image gallery is conditional on `lotInfo.image` being truthy.

### `AuctionLotWithBidComponents({ lot, lotNumber, topBid? })`
Live lot message during auction. Shows current top bid (`Current Bid: X by @mention`) or "Starting Bid: X — No bids yet". Always has `+100k Bid` + `Custom Bid` buttons. Image conditional on `lot.image`.

### `AuctionLotEndedComponents({ lot: LotWinnerRow })`
Final lot state. No buttons. Shows `### Lot N: Title — ENDED` and either `**Winner:** @mention | **Winning Bid:** X` or `**No winner — no bids were placed**`. Image conditional.

### `BidConfirmationComponents({ lotId, parsedAmount, lotTitle })`
Ephemeral confirmation after modal submit. Shows parsed amount and lot title. Buttons: `✅ Confirm Bid` (customId: `bid-confirm:<lotId>:<amount>`), `❌ Cancel` (customId: `bid-cancel`).

### `AuctionReminderOptInComponents({ auctionId, auctionEndTime, states })`
Sent via DM (or ephemeral fallback). Shows auction end time as `:F` (full date) and `:R` (relative). Three toggle buttons; each shows `✅` prefix and `ButtonStyle.Success` when active, `ButtonStyle.Secondary` when inactive. Buttons are disabled if their reminder time has already passed.

### `AuctionSummaryMessageComponents({ auctionLots, endDate, channel, auctionId, isTest })`
Summary message posted after all lots. Jump links to each lot. Has `🔔 Remind Me` button only if `!isTest`.

### `WinnerDMMessageComponents(wonLots: LotWinnerRow[])`
DM sent to each winner at auction end. Lists all lots won with amounts. "Contact an officer" instructions included.

---

## DatabaseManager New Methods

All in `src/utils/databaseManager.ts`:

| Method | Query / Notes |
|--------|--------------|
| `getActiveAuction()` | `SELECT * FROM auctions WHERE end_time > strftime('%s', 'now') LIMIT 1` |
| `insertAuctionLot(data)` | Returns `number` (lastInsertRowid) |
| `updateAuctionLotMessageId(lotId, messageId)` | Called after message is sent to persist the Discord message ID |
| `getAuctionLot(id)` | By lot DB id |
| `getAuctionLots(auctionId)` | All lots for an auction, ordered by `lot_number ASC` |
| `insertBid(data)` | Race-safe: wrapped in `db.transaction()` that re-reads top bid; returns `null` if `amount <= currentTop.amount` |
| `getTopBid(lotId)` | `ORDER BY amount DESC LIMIT 1` |
| `getWinnersForAuction(auctionId)` | LEFT JOIN `auction_lots` + subquery for top bid per lot; returns `LotWinnerRow[]` |
| `getAuctionReminderForUser(auctionId, userId, offsetSeconds)` | JOIN `reminders` + `auctions`; matches on `remind_at = end_time - offsetSeconds` |

Runtime migrations in `DatabaseManager` constructor (safe to run repeatedly — wrapped in try/catch):
- `ALTER TABLE auctions ADD COLUMN is_test INTEGER DEFAULT 0`
- `ALTER TABLE auction_lots ADD COLUMN description TEXT`
- `ALTER TABLE auction_lots ADD COLUMN image TEXT`

---

## Known Issues / Bugs Fixed During Review

### Fixed: `quickBid.ts` operator precedence bug
**Original**: `(topBid?.amount ?? lot.starting_bid! - 1000) + 100000`  
**Problem**: `??` has lower precedence than `-`, so this parsed as `(topBid?.amount ?? (lot.starting_bid! - 1000)) + 100000`. On the very first bid (no existing bids), the amount would be `startingBid + 99,000` instead of `startingBid + 100,000` — off by 1,000g.  
**Fixed to**: `(topBid?.amount ?? lot.starting_bid!) + 100000`

### Fixed: `AuctionLotMessageComponents` sending empty-URL media gallery
**Original**: Always appended a `MediaGallery` with `lotInfo.image || ''` as the URL.  
**Problem**: Lots without images would send an empty-string URL to Discord.  
**Fixed to**: Conditional `if (lotInfo.image)` guard, consistent with `AuctionLotWithBidComponents` and `AuctionLotEndedComponents`.

---

## Known Limitations / Not Yet Implemented

### Outbid notifications (deliberately deferred)
The original goals included "opt-in to auction reminders **and outbid notices**." Outbid notifications were omitted from `plan.md` and have not been implemented. Implementation requires a separate design pass. Key considerations:

- Needs to determine: opt-in toggle per auction (similar to reminders), or always-on for anyone who has placed a bid?
- On every successful bid insert, the previous top bidder must be identified and notified
- Notification delivery: DM preferred; needs fallback for closed DMs
- Design question: should the outbid DM contain a jump link to the lot so the user can re-bid?
- Must not spam: if a bid war occurs rapidly, should there be any rate limiting or consolidation of outbid messages?
- DB consideration: no schema changes strictly required (the previous top bidder is already tracked in `bids`), but an opt-out mechanism would need a table (or just always-notify anyone who has ever bid on a lot)
- This feature is pending a detailed implementation writeup from the project owner before work begins

### Self-overbidding allowed
A user can click `+100k Bid` or submit a Custom Bid even when they are already the top bidder, raising their own bid. This is intentional by design — officers confirmed this is acceptable behaviour (e.g. a user who wants to create more distance between their bid and the minimum increment).

### Multiple Remind Me DMs
If a user clicks 🔔 Remind Me more than once, they receive multiple DM messages each with toggle buttons. Old messages may show stale button states, but the subscription state in DB is always accurate. This is accepted as user error — no dedup logic is implemented.

### AuctionEndScheduler only handles one active auction
`getActiveAuction()` is a `LIMIT 1` query. The system is designed around the invariant that at most one active auction exists at any time. `startAuction.ts` enforces this by deleting any existing active auction before inserting a new one.
