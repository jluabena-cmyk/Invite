---
name: ItemAssignmentWithUser fields
description: The claimer/assignment type shape — easy to get wrong since it differs from ParticipantSummary.
---

## ItemAssignmentWithUser (from api.schemas.ts)
- id: number
- receiptItemId: number
- userId: number
- claimed: boolean
- userDisplayName: string   ← NOT "displayName"

## ParticipantSummary
- userId, displayName, handle, avatarUrl, role

**Why:** TS error hit when using c.displayName on a claimer — the correct field is userDisplayName.
**How to apply:** Whenever rendering claimer names from activeClaimersFor() results, use c.userDisplayName, not c.displayName.
