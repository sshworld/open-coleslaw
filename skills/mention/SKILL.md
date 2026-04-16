---
name: mention
description: "View and respond to pending @mentions from agent meetings. Agents create @mentions when they need a human decision on important topics like architecture choices, budget implications, or unresolved disagreements."
---

# Handle @Mentions

## Steps

1. Call `get-mentions` with `{ status: "pending" }` to list all pending decisions
2. If there are pending mentions, present each one to the user:
   - Show the **summary** of what needs deciding
   - Show the **options** (A, B, C, etc.)
   - Show which leaders support which option
   - Show the **urgency** (blocking = meeting is paused, advisory = FYI)
3. Ask the user which option they choose
4. Call `respond-to-mention` with their decision:
   ```
   respond-to-mention({
     mentionId: "the-mention-id",
     decision: "Option A: description",
     reasoning: "user's reasoning"  // optional
   })
   ```

## If No Mentions
Tell the user there are no pending decisions and suggest checking `/status` for overall state.
