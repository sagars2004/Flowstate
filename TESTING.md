# 🧪 Flowstate Testing Guide

## ✅ What's Ready to Test Right Now

### Backend Server Status
**✓ Running on:** http://localhost:3001  
**✓ Database:** SQLite configured and migrated  
**✓ AI:** Groq integration enabled  
**✓ API:** Full REST API operational  

---

## 🚀 Quick Start Tests

### 1. Health Check
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-10T...",
  "uptime": 123.456
}
```

---

### 2. Create a Session
```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "startTime": "2024-01-10T...",
    "endTime": null,
    "focusScore": null,
    "status": "active",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**💡 Save the `id` from the response - you'll need it for the next tests!**

---

### 3. Log Some Activities
Replace `YOUR_SESSION_ID` with the ID from step 2:

```bash
# Log typing activity
curl -X POST http://localhost:3001/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "eventType": "typing",
    "typingVelocity": 180.5,
    "url": "https://github.com"
  }'

# Log tab switch
curl -X POST http://localhost:3001/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "eventType": "tab_switch",
    "url": "https://twitter.com"
  }'

# Log batch of activities
curl -X POST http://localhost:3001/api/activities/batch \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "sessionId": "YOUR_SESSION_ID",
        "eventType": "typing",
        "typingVelocity": 175.0,
        "url": "https://github.com"
      },
      {
        "sessionId": "YOUR_SESSION_ID",
        "eventType": "tab_switch",
        "url": "https://stackoverflow.com"
      },
      {
        "sessionId": "YOUR_SESSION_ID",
        "eventType": "idle_end",
        "idleDuration": 120
      }
    ]
  }'
```

---

### 4. Get Session Statistics
```bash
curl http://localhost:3001/api/sessions/YOUR_SESSION_ID/statistics
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "startTime": "...",
    "status": "active",
    "statistics": {
      "totalActivities": 5,
      "totalTypingTime": 50000,
      "totalIdleTime": 120,
      "tabSwitchCount": 2
    }
  }
}
```

---

### 5. End the Session
```bash
curl -X PATCH http://localhost:3001/api/sessions/YOUR_SESSION_ID/end \
  -H "Content-Type: application/json" \
  -d '{
    "focusScore": 85.5
  }'
```

---

### 6. Get All Sessions
```bash
# Get all sessions
curl http://localhost:3001/api/sessions

# Get completed sessions only
curl "http://localhost:3001/api/sessions?status=completed"

# Get with pagination
curl "http://localhost:3001/api/sessions?limit=10&offset=0"
```

---

## 🔍 Advanced Testing

### Query Activities by Session
```bash
curl "http://localhost:3001/api/activities?sessionId=YOUR_SESSION_ID"

# Filter by event type
curl "http://localhost:3001/api/activities?sessionId=YOUR_SESSION_ID&eventType=typing"
```

### Delete a Session
```bash
curl -X DELETE http://localhost:3001/api/sessions/YOUR_SESSION_ID
```

---

## 🤖 AI Features (Requires GROQ_API_KEY)

If you've set up your Groq API key in `backend/.env`, the AI features are enabled.

**Note:** AI endpoints will be added in upcoming todos:
- Real-time intervention generation (pattern-recognition todo)
- Post-session insights (session-analysis todo)
- Technique recommendations

---

## 🎯 What's NOT Ready Yet

These features are in upcoming todos:

❌ **Frontend UI** - No visual interface yet (coming in live-session-ui, dashboard-page todos)  
❌ **Chrome Extension** - No browser monitoring yet (coming in setup-extension todo)  
❌ **WebSocket** - No real-time push notifications yet (coming in extension-backend-comm todo)  
❌ **Pattern Recognition** - AI pattern detection not hooked up yet (next todo!)  
❌ **Demo Data** - No pre-seeded sessions yet (coming in demo-data todo)  

---

## 📊 Using Postman or Insomnia (Recommended)

For easier testing, import this collection:

1. Create a new request collection
2. Set base URL: `http://localhost:3001/api`
3. Add requests for each endpoint (see `backend/API.md` for full spec)
4. Save session IDs as collection variables for reuse

---

## 🐛 Troubleshooting

### Server Not Starting?
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill any process using it
lsof -ti:3001 | xargs kill -9

# Restart server
npm run dev:backend
```

### Database Issues?
```bash
# Re-run migrations
npm run db:migrate

# Check database file exists
ls -la backend/data/flowstate.db
```

### AI Not Working?
```bash
# Check if API key is set
cat backend/.env | grep GROQ_API_KEY

# Server should show "🤖 Groq AI: Enabled" on startup
```

---

## 📚 Full API Documentation

See `backend/API.md` for complete API specification with all endpoints, parameters, and response schemas.

---

## ✅ Testing Checklist

- [ ] Health check endpoint works
- [ ] Can create a new session
- [ ] Can log individual activities
- [ ] Can log activities in batch
- [ ] Can retrieve session by ID
- [ ] Can get session statistics
- [ ] Can query activities by session
- [ ] Can filter activities by type
- [ ] Can end a session with focus score
- [ ] Can list all sessions with filters
- [ ] Can delete a session
- [ ] Focus score calculation is reasonable

---

## 🎉 Next Steps

Once you've tested the API, we'll move on to:
1. **Pattern Recognition Engine** - Detect distraction patterns
2. **Chrome Extension** - Browser monitoring
3. **Frontend UI** - Visual interface
4. **WebSocket** - Real-time updates

Happy testing! 🚀
