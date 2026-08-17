---
name: Bill tab layout
description: Current bill tab structure after the Phase 1 refactor — compact rows, modal, tip selector, two-column totals.
---

## Layout order (bill tab)
1. Receipt Photos — horizontal scroll; existing photos + "Add More" dashed tile (host); Take/Choose buttons below
2. Line Items card — compact rows: name + inline assigned-person chips (left), price/person + total + › chevron (right); collapses after ITEMS_SHOW_COUNT=8
3. Tip Selector — 15%/18%/20% quick-select auto-saves; Custom shows tipInput field; host only; rendered only when receipt + items exist
4. Totals card — two-column side-by-side: left = Items Subtotal/Tax/Tip/Grand Total; right = per-person avatar rows + Unallocated
5. Host Tools — Edit Totals + Add Item accordion accordions (host + !cancelled only)

## Assignment modal
- Opens when any item row is tapped (setAssigningItemId)
- Shows all activeParticipants with toggle
- Host: all rows interactive — self uses handleToggleClaim, others use handleHostAssign
- Guest: only self row interactive
- Host can delete item from the modal
- Loading tracked via claimingItemId (self) and togglingUserId (host-assigned others)

## Tip mode detection
- On receipt load (totalsInitedRef), compares tip/subtotal ratio: ±0.005 for 15/18/20%, else "custom"
- handleSelectTipPercent(pct) calculates from dbSubtotalCents (falls back to itemsSubtotalCents), sets tipInput + calls updateReceipt directly

**Why:** Sticky bar + old itemCard chip layout removed to match reference design screenshot from user.
