## Plan: Full Auction Bidding & Lifecycle Overhaul

Button-based bidding replacing threads, live message updates per bid, an auction-end scheduler that auto-closes lots and DMs winners, and "Remind Me" opt-in toggle reminders — all backed by SQLite with race-safe transactions and persisted across restarts. When developing this functionality, keep in mind that most users are likely to skim over text or blatanly ignore reading, so we should try to make this as simple for the users as possible while achieving all the included goals.


### Phase 1: Database Schema Expansion





1. **Add** `auction_lots` table to schema.sql:
   * `id INTEGER PRIMARY KEY AUTOINCREMENT`, `auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE`, `message_id TEXT`, `channel_id TEXT`, `lot_number INTEGER`, `title TEXT`, `starting_bid INTEGER`
   * Index on `auction_id`
2. **Add** `bids` table to schema.sql:
   * `id INTEGER PRIMARY KEY AUTOINCREMENT`, `lot_id INTEGER NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE`, `user_id TEXT`, `amount INTEGER`, `created_at INTEGER DEFAULT (strftime('%s', 'now'))`
   * Index on `lot_id`
3. **Add new types** to database.ts: `AuctionLotRow`, `AuctionLotInsert`, `BidRow`, `BidInsert` *(parallel with step 2)*
4. **Expand** `DatabaseManager` in databaseManager.ts:
   * `insertAuctionLot(data)` returning `lastInsertRowid`
   * `updateAuctionLotMessageId(lotId, messageId)`
   * `getAuctionLot(id)`
   * `getAuctionLots(auctionId)`
   * `insertBid(data)` — wrapped in `db.transaction()` that re-reads `getTopBid` before inserting (race guard)
   * `getTopBid(lotId)` — `SELECT * FROM bids WHERE lot_id = ? ORDER BY amount DESC LIMIT 1`
   * `getWinnersForAuction(auctionId)` — JOIN bids + auction_lots, top bid per lot
   * `getAuctionReminderForUser(auctionId, userId, offsetSeconds): ReminderRow | undefined`


### Phase 2: Update `startAuction.ts`

*Depends on Phase 1*


5\. Call `Database.insertAuction({ id: interaction.message.interaction.id, end_time, channel_id })` — ⚠️ this method exists but is **never currently called**; this is the first call
6\. For each posted lot message:
\* `Database.insertAuctionLot(...)` → get `lotId` from `lastInsertRowid`
\* `Database.updateAuctionLotMessageId(lotId, message.id)`
7\. **Remove thread creation** entirely (user confirmed)
8\. Post each lot's `ContainerBuilder` including an `ActionRow` with two buttons:
\* `+100k Bid` (Secondary), customId: `bid-quick:${lotId}`
\* `Custom Bid` (Primary), customId: `bid-custom:${lotId}`
9\. Add `🔔 Remind Me` button to `AuctionSummaryMessageComponents` in an `ActionRow`, customId: `auction-remind:${auctionId}` (*only if not a test auction*)
10\. Call `AuctionEndScheduler.scheduleAuctionEnd(auctionId, endDate, isTest)` (*depends on Phase 5*)
11\. Add `is-test` boolean option to `/auction` command in auction.ts; pass through to `startAuction.ts`; also add `is_test INTEGER DEFAULT 0` column to `auctions` table


### Phase 3: Bid Interaction Handlers

`src/interaction-handlers/quickBid.ts` (new)


12\. Parse `bid-quick:<lotId>` — in `run()`:
\* Defer ephemeral; fetch lot + auction from DB; verify `auction.end_time > now`
\* `getTopBid(lotId)` — compute `newAmount = (topBid?.amount ?? startingBid - 1000) + 100000`
\* DB transaction: re-read top bid, insert if `newAmount > currentTop` (handles edge race)
\* `channel.messages.fetch(lot.message_id)` → `message.edit(AuctionLotWithBidComponents(...))`
\* Reply ephemeral: "Your bid of **100,000g** has been placed!"

`src/interaction-handlers/customBid.ts` (new)


13\. Parse `bid-custom:<lotId>` — in `run()`:
\* Fetch lot + auction; verify active; get `topBid`
\* `interaction.showModal(BuildCustomBidModal({ lotId, lotTitle, minBid: topBid?.amount + 1000 ?? startingBid }))`
\* Modal contains: one `Label` wrapping a `TextInput` (customId: `bid_amount`, placeholder: "e.g. 50000 or 50k"); modal customId: `bid-custom-modal:${lotId}`

`src/interaction-handlers/customBidModal.ts` (new — ModalSubmit handler)


14\. Parse `bid-custom-modal:<lotId>` — in `run()`:
\* `interaction.fields.getField('bid_amount').value` → `parsedAmount = numeral(value).value()`
\* If parse fails or `parsedAmount <= 0`: reply ephemeral error "Could not parse your bid"
\* Validate `parsedAmount % 1000 === 0`; if not: error "Bids must be a multiple of 1,000g"
\* Fetch top bid; validate `parsedAmount >= topBid.amount + 1000`; if not: error "Minimum bid is X"
\* If valid: reply ephemeral with `BidConfirmationComponents({ lotId, parsedAmount, lotTitle })`:
\* Text: "I parsed your bid as **\[amount\]g** for \[lotTitle\]. This is final and cannot be reversed."
\* ActionRow: `[✅ Confirm Bid]` (Success, customId: `bid-confirm:${lotId}:${parsedAmount}`) and `[❌ Cancel]` (Danger, customId: `bid-cancel`)

`src/interaction-handlers/customBidConfirm.ts` (new)


15\. Parse `bid-confirm:<lotId>:<amount>` — in `run()`:
\* Defer update (edit ephemeral in place)
\* Re-fetch lot + auction; verify still active; get current top bid
\* Re-validate `parsedAmount >= topBid.amount + 1000` (could have been outbid while modal was open)
\* If outbid: update ephemeral: "You've been outbid since your modal opened. Current top: \[X\]g. Please bid again."
\* If still valid: transaction → insert bid → edit lot message → update ephemeral: "Bid placed! ✅"

`src/interaction-handlers/customBidCancel.ts` (new or inlined in `customBidConfirm`)


16\. Parse `bid-cancel` → update ephemeral: "Bid cancelled."


### Phase 4: "Remind Me" Opt-In System

`src/interaction-handlers/auctionReminderOptIn.ts` (new)


17\. Parse `auction-remind:<auctionId>` — in `run()`:
\* Fetch auction; verify active
\* For each of 3 offsets (`86400`, `3600`, `900`): check DB for existing reminder row for this user + auction + offset
\* Reply ephemeral with `AuctionReminderOptInComponents({ auctionId, states: { day: bool, hour: bool, min: bool }, auctionEndTime })` — toggle buttons, disabled if offset time has already passed

`src/interaction-handlers/auctionReminderToggle.ts` (new)


18\. Parse `auction-remind-toggle:<auctionId>:<offsetSeconds>` — in `run()`:
\* Check DB for existing reminder
\* If exists: `ReminderScheduler.cancelReminder(reminderId)` (cancels node-schedule job + deletes from DB)
\* If not exists: `Database.insertReminder({ user_id, channel_id: auction.channel_id, message: '⏰ An auction you are watching is ending soon!', remind_at: auction.end_time - offset, auction_id })` then `ReminderScheduler.scheduleReminder(newId)`
\* `interaction.update(AuctionReminderOptInComponents({ ...newStates }))` to toggle the button styles in the ephemeral


### Phase 5: Auction End Scheduler

`src/utils/auctionEndScheduler.ts` (new)


19\. `scheduleAuctionEnd(auctionId, endDate, isTest)`:
\* `nodeSchedule.scheduleJob('auction-end:${auctionId}', endDate, () => executeAuctionEnd(auctionId, isTest))`
20\. `executeAuctionEnd(auctionId, isTest)`:
\* Fetch all `auction_lots` rows; for each lot get `getTopBid(lot.id)`
\* For each lot: fetch + edit the lot message → `AuctionLotEndedComponents({ lot, winnerId, winningAmount })`
\* Group winning lots by `user_id`; if `!isTest`: send winner DMs via `WinnerDMMessageComponents`; log DM failures gracefully
\* Post a summary message in the auction channel: "🏁 Auction has ended! Winners have been notified via DM."
\* Auction-linked reminders auto-delete via `ON DELETE CASCADE` if auction record is deleted, OR leave DB intact (keep history) and cancel pending node-schedule reminder jobs manually via `getAuctionReminders(auctionId)` → `ReminderScheduler.cancelReminder(each)`
21\. **On bot startup**: in ready.ts (or a new `ready` listener), query all auctions with `end_time > now` and re-register end jobs. Pattern mirrors how `ReminderScheduleManager` rehydrates on startup.
22\. Export `new AuctionEndScheduler()` from state.ts *(parallel with step 21)*


### Phase 6: Message Component Functions (all in `messageComponentUtil.ts`)


23\. `AuctionLotWithBidComponents` — existing lot layout + separator + "**Current Bid:** \[amount\]g by @mention" or "**Starting Bid:** \[amount\]g — No bids yet" + separator + ActionRow (2 buttons)
24\. `AuctionLotEndedComponents` — same layout, no buttons, shows "**Winner:** @mention | **Winning Bid:** \[amount\]g" or "**No winner — no bids placed**"
25\. `BidConfirmationComponents` — ephemeral message with parsed bid info + Confirm + Cancel buttons
26\. `AuctionReminderOptInComponents` — 3 toggle buttons for day/hour/15min reminders
27\. `WinnerDMMessageComponents` — DM listing all lots won with amounts


### Phase 7: Constants Update


28\. Add to constants.ts `BUTTON_IDS`:
\* `BID_QUICK: 'bid-quick'`
\* `BID_CUSTOM: 'bid-custom'`
\* `BID_CONFIRM: 'bid-confirm'`
\* `BID_CANCEL: 'bid-cancel'`
\* `AUCTION_REMIND: 'auction-remind'`
\* `AUCTION_REMIND_TOGGLE: 'auction-remind-toggle'`


**Relevant files**

* schema.sql — add `auction_lots`, `bids` tables; add `is_test` column to `auctions`
* database.ts — add `AuctionLotRow`, `AuctionLotInsert`, `BidRow`, `BidInsert`
* databaseManager.ts — all new DB methods + transaction-wrapped bid insert
* src/utils/auctionEndScheduler.ts — NEW
* messageComponentUtil.ts — 5 new component builder functions
* constants.ts — new button IDs
* state.ts — export `AuctionEndScheduler` instance
* auction.ts — add `is-test` flag
* startAuction.ts — major update (DB saves, bid buttons, no threads, end scheduling)
* src/interaction-handlers/quickBid.ts — NEW
* src/interaction-handlers/customBid.ts — NEW
* src/interaction-handlers/customBidModal.ts — NEW (ModalSubmit handler)
* src/interaction-handlers/customBidConfirm.ts — NEW
* src/interaction-handlers/auctionReminderOptIn.ts — NEW
* src/interaction-handlers/auctionReminderToggle.ts — NEW
* ready.ts — re-register auction end jobs on startup


**Verification**





1. Post test auction (`--is-test`) → confirm: lots appear with bid buttons, no threads, DB has auction + lots rows
2. Click `+100k Bid` → confirm: lot message updates with new bid + mention, DB has bid row
3. Click `Custom Bid`: enter `"50k"` → modal submits → bot shows ephemeral "Parsed: **50,000g** — confirm?" → click Confirm → lot message updates, bid in DB
4. Enter `"50001"` → ephemeral error: "must be a multiple of 1,000g"
5. Have two users click bid simultaneously → only one succeeds, other gets ephemeral outbid message
6. Click `🔔 Remind Me` → 3 toggle buttons appear → toggle each independently → confirm DB reminder rows appear/disappear → confirm node-schedule jobs register/deregister correctly
7. Run 2-minute test auction to end time → confirm: all lot messages show ended state (no buttons, winner shown), no DMs sent (test mode), channel receives "Auction ended" message
8. Run live auction to end → winner DMs arrive listing all lots won


**⚠️ Key Gotchas (already accounted for in plan)**

* `LabelBuilder` + `CheckboxBuilder` in 14.26: These appear in discord.js `main` branch docs. Verify at build time that `import { LabelBuilder } from 'discord.js'` resolves in 14.26.x. The custom bid modal only needs a `LabelBuilder` wrapping a `TextInput` (for the label text above the input field); no checkbox required since confirmation happens in step 2 via buttons.
  * Note: THESE ARE IMPLEMENTED IN DISCORD.JS, NO WORRIES HERE!
* **Modal → Modal is impossible**: Discord does not allow showing a modal from a `ModalSubmitInteraction`. The two-step flow (ephemeral buttons after modal submit) works around this correctly.
  * NO WORRIES, WE DO WHAT WE MUST.
* `insertAuction()` is currently never called in the existing code. Phase 2 step 5 adds the first call.
  * THIS IS INTENTIONAL, WE NEVER GOT AROUND TO USING THIS YET
* **Bid race conditions**: The `db.transaction()` wrapper around read-then-insert for bids is critical. `better-sqlite3` is synchronous so the transaction is truly atomic within the Node.js process.
* **Post-restart state**: All message IDs and auction state live in SQLite. After a restart, bid button interactions fetch `lot.message_id` from DB and call `channel.messages.fetch(messageId)` to re-obtain the Discord message for editing. Auction end jobs and reminder jobs are rehydrated from DB on startup.
* **DMs disabled**: Winner DMs and reminder DMs can fail silently. The existing `sendReminder` pattern (try/catch, log failure) is the right model. A channel post of "Auction ended" after DMs is a safeguard.
  * IF THE USER HAS DMS DISABLED, THEY SHOULD SIMPLY NOT RECEIVE ANY DMS (AND THEREFORE CANNOT GET REMINDERS). THIS IS FINE, AND A CAVEAT THEY MUST DEAL WITH DUE TO THEIR OWN SETTINGS. WE WON’T CHANGE OUR WORKFLOW TO ACCOMODATE THEIR SETTINGS.


