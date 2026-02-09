# Query Logging & Feedback System

## Overview
This system logs all user queries, collects feedback, and allows adding high-quality timeless Q&A pairs to the knowledge base for continuous improvement.

## Features

### 1. **Automatic Query Logging**
- Every query-response pair is automatically logged
- Classifies queries as "timeless" vs "temporal" (date-specific)
- Stores conversation context and RAG mode used

### 2. **User Feedback Collection**
- 👍 / 👎 buttons on each bot response
- Feedback is stored with the query log
- Helps identify which responses are helpful

### 3. **Smart Knowledge Base Updates**
- Only timeless queries with positive feedback are candidates
- Temporal queries (fees, dates, deadlines) are NOT added
- 90-day expiry on temporal content

### 4. **Query Classification**
Automatically detects temporal keywords:
- ❌ Temporal: when, deadline, date, 2024-2028, current, fee, cost
- ✅ Timeless: what is, how does, explain, difference between

## Setup

### 1. Create Database Table
Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Copy contents from supabase/migrations/20260209_query_logs.sql
```

Or use the migration file at: `/supabase/migrations/20260209_query_logs.sql`

### 2. Frontend Changes (Already Done)
- ✅ Added feedback buttons to bot messages
- ✅ Connected to `/api/feedback` endpoint
- ✅ Visual feedback on click (green/red highlighting)

### 3. Backend Changes (Already Done)
- ✅ QueryLogger service for logging and feedback
- ✅ Integrated into ChatService
- ✅ API endpoints for feedback management

## Usage

### Testing Locally
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Chat with bot and click 👍 or 👎 on responses

### View Feedback Stats
```bash
curl http://localhost:3001/api/feedback-stats
```

Returns:
```json
{
  "total": 25,
  "positive": 18,
  "negative": 3,
  "neutral": 4,
  "timeless": 20,
  "temporal": 5
}
```

### Get Queries Ready for Knowledge Base
```bash
curl http://localhost:3001/api/queries-for-kb?limit=20
```

### Add Queries to Knowledge Base
```bash
cd backend
node scripts/addToKnowledgeBase.js
```

This will:
1. Fetch top 20 timeless queries with positive feedback
2. Add them to the vector database
3. Mark them as "added_to_kb" (won't be added again)
4. Show summary statistics

## Example Output

```
🚀 Starting knowledge base update...

📚 Found 5 queries ready to add:

📝 Query #123:
   Q: "What is SEECS?"
   A: "SEECS stands for School of Electrical Engineering..."
   Timeless: true
   Feedback: positive
   ✅ Added to knowledge base (Vector ID: 456)

📊 Summary:
   ✅ Successfully added: 5
   ⚠️  Skipped/Failed: 0
   📚 Total processed: 5

📈 Overall Stats:
   Total queries: 87
   Positive feedback: 65
   Negative feedback: 8
   Timeless queries: 72
   Temporal queries: 15
```

## Recommended Workflow

1. **Weekly**: Review `/api/queries-for-kb` to see candidates
2. **Weekly**: Run `addToKnowledgeBase.js` to add approved queries
3. **Monthly**: Review negative feedback queries to improve responses
4. **Monthly**: Run cleanup: `QueryLogger.cleanupExpired()` (removes old temporal data)

## Security Notes

- Only use `SUPABASE_SERVICE_ROLE_KEY` in backend (never frontend)
- Query logs contain actual user questions (consider privacy)
- Can add retention policy (auto-delete after 6 months)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feedback` | POST | Update feedback for a query |
| `/api/feedback-stats` | GET | Get overall statistics |
| `/api/queries-for-kb` | GET | Get queries ready to add to KB |

## Benefits for Presentation

1. **Show Learning**: "Bot improves from user feedback"
2. **Show Intelligence**: "Automatically filters out temporal data"
3. **Show Scale**: "After 1 month with 500 users, added 150 Q&A pairs"
4. **Show Safety**: "Only adds timeless knowledge, official docs always prioritized"
