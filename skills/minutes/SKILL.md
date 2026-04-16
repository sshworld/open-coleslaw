---
name: minutes
description: "Browse and search meeting minutes. Use with a meeting ID to view specific minutes, or without arguments to list recent meetings. Minutes are in PRD format with decisions, action items, and technical specs."
---

# Browse Meeting Minutes

## With a Meeting ID
If the user provides a meeting ID:
1. Call `get-minutes` with `{ meetingId: "the-id", format: "full" }`
2. Display the full PRD-format minutes

## Without Arguments
1. Call `list-meetings` with `{ limit: 10 }` to show recent meetings
2. Present a numbered list with topic, status, and date
3. Ask the user which meeting they want to see

## Search
If the user wants to search (e.g., "minutes about authentication"):
1. Call `list-meetings` to get all meetings
2. Filter by topic keyword matching
3. Show matching meetings
