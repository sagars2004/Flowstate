# Testing Guide for New Features

This guide covers all the newly implemented features ready for testing.

## 🆕 What's New to Test

### 1. **Chrome Extension (Manifest V3)** ✨
**Status**: Fully implemented, needs to be built first

#### Setup:
```bash
# Build the extension
cd extension
npm run build

# Or from root:
npm run build:extension
```

#### Load in Chrome:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/dist` directory
5. The Flowstate extension should appear

#### Test Features:
- **Popup UI**: Click the extension icon to see session control
- **Session Management**: 
  - Click "Start Session" - should create a session ID
  - Click "End Session" - should gracefully end the session
  - Session status should show in popup
- **Tab Tracking**: 
  - Switch between tabs - activities should be logged
  - Check backend logs to see tab_switch events
- **Typing Detection**: 
  - Type on any webpage - typing velocity should be measured
  - Activities should appear in backend after ~10 seconds (batching)
- **Idle Detection**: 
  - Stay idle for 30+ seconds - should trigger idle_start event
  - Move mouse/keyboard - should trigger idle_end event
- **Connection Status**: 
  - Should show connection status in popup
  - If backend is not running, should show "Disconnected"
  - Should automatically reconnect when backend starts

### 2. **WebSocket Real-Time Communication** 🌐
**Status**: Fully integrated and ready

#### Test WebSocket Connection:

**Backend Logs** (when extension connects):
```
Client connected: <socket-id> (type: extension)
Session started: <session-id>
```

**Test from Browser Console** (in your frontend):
```javascript
// Connect to WebSocket
const socket = io('http://localhost:3001', { query: { clientType: 'frontend' } });

socket.on('connect', () => {
  console.log('Connected!', socket.id);
});

socket.on('session:update', (data) => {
  console.log('Session update:', data);
});

socket.on('intervention:send', (intervention) => {
  console.log('Intervention received:', intervention);
});

// Subscribe to a session
socket.emit('session:subscribe', 'your-session-id');
```

**Test Events**:
- Start session from extension → See `session:update` events
- Log activities → See real-time `session:update` with focus score
- Trigger pattern → See `intervention:send` events
- End session → See `session:update` with status 'completed'

### 3. **Real-Time AI Interventions** 🤖
**Status**: Fully implemented with pattern detection

#### How to Trigger Interventions:

**Test Context-Switching Pattern**:
1. Start a session from extension
2. Rapidly switch tabs (5+ times in 30 seconds)
3. Should receive intervention: "You've context-switched X times..."
4. Intervention appears in:
   - Browser notification (from extension)
   - WebSocket event (if frontend is listening)

**Test Social Media Spiral**:
1. Visit Twitter/X 3+ times in quick succession
2. Should detect "social_media_spiral" pattern
3. Intervention should suggest a break or focus technique

**Test Extended Idle**:
1. Go idle for 2+ minutes
2. Should detect "extended_idle" pattern
3. Intervention should suggest taking a break or getting back to work

**Check Backend Logs**:
```bash
# Should see:
Analyzing pattern for session: <id>
Pattern detected: context_switching
Generating intervention...
Intervention sent to extension and frontend
```

### 4. **Improved Groq Model Handling** 🔧
**Status**: Fixed with fallback mechanism

#### Test Model Fallback:
```bash
# Set an invalid model to test fallback
export GROQ_MODEL_70B="invalid-model-name"

# Start backend
npm run dev:backend

# Try to generate insights - should see:
⚠️  Model invalid-model-name is decommissioned. Falling back to llama-3.1-8b-instant...
✓ Successfully used llama-3.1-8b-instant as fallback for deep analysis
```

#### Test with Correct Model:
```bash
# Use the updated default (or set your own)
export GROQ_MODEL_70B="llama-3.3-70b-versatile"  # or check Groq docs for latest

# Generate insights - should work normally
```

### 5. **Activity Batching** ⚡
**Status**: Implemented in extension

#### Test:
1. Start a session
2. Type continuously on a webpage
3. Check backend logs - should see activities batched every ~10 seconds
4. Check database - activities should be logged in batches, not individually

### 6. **Pattern Recognition in Real-Time** 📊
**Status**: Working via WebSocket handler

#### Test Pattern Detection:
```bash
# Create a session with API
curl -X POST http://localhost:3001/api/sessions

# Log rapid tab switches
for i in {1..8}; do
  curl -X POST http://localhost:3001/api/activities \
    -H "Content-Type: application/json" \
    -d '{
      "sessionId": "your-session-id",
      "eventType": "tab_switch",
      "url": "https://twitter.com"
    }'
  sleep 0.5
done

# Check backend logs for pattern detection
# Should see intervention generated automatically
```

## 🧪 Quick Test Checklist

### Extension Tests:
- [ ] Extension builds without errors
- [ ] Extension loads in Chrome
- [ ] Popup shows session controls
- [ ] Start session creates session ID
- [ ] Tab switches are tracked
- [ ] Typing velocity is measured
- [ ] Idle detection works (30+ seconds)
- [ ] Connection status shows correctly
- [ ] End session clears state

### WebSocket Tests:
- [ ] Extension connects to backend
- [ ] Session start event is received
- [ ] Activity events are transmitted
- [ ] Session updates are broadcast
- [ ] Interventions are delivered
- [ ] Reconnection works after disconnect

### Pattern & Intervention Tests:
- [ ] Context-switching triggers intervention
- [ ] Social media spiral is detected
- [ ] Extended idle triggers suggestion
- [ ] Interventions appear in notifications
- [ ] Interventions are sent via WebSocket

### Backend Integration Tests:
- [ ] Activities are stored in database
- [ ] Focus score is calculated in real-time
- [ ] Pattern analysis runs automatically
- [ ] AI interventions are generated (if GROQ_API_KEY set)
- [ ] Model fallback works if 70B model fails

## 🐛 Known Limitations to Test

1. **Extension Icons**: Need to add actual icon files (placeholder exists)
2. **Frontend UI**: Still placeholder pages - WebSocket integration ready but UI not built
3. **Model Names**: May need to update `GROQ_MODEL_70B` based on Groq's current offerings
4. **Content Script**: Typing detection works but may need refinement for different sites

## 📝 Test Scripts Available

### Existing Scripts:
```bash
# Test backend API features
./test-new-features.sh

# Test basic API endpoints
./test-api.sh
```

### Manual Testing Steps:

1. **Start Backend**:
   ```bash
   npm run dev:backend
   ```

2. **Build Extension**:
   ```bash
   npm run build:extension
   ```

3. **Load Extension** in Chrome (see Setup above)

4. **Start Frontend** (optional, for WebSocket testing):
   ```bash
   npm run dev:frontend
   ```

5. **Start Session** from extension popup

6. **Interact** with browser (switch tabs, type, go idle)

7. **Monitor**:
   - Backend console for events
   - Extension popup for status
   - Browser notifications for interventions
   - Frontend console for WebSocket events (if running)

## 🎯 What to Verify

### ✅ Success Criteria:
- Extension tracks activities accurately
- WebSocket connection is stable
- Activities appear in database
- Patterns are detected correctly
- Interventions are timely and relevant
- Fallback works if models are unavailable
- No crashes or memory leaks during long sessions

### 🔍 Things to Watch For:
- Service worker lifecycle issues (extension may disconnect)
- WebSocket reconnection after backend restart
- Typing velocity calculation accuracy
- Pattern detection false positives/negatives
- Intervention timing (not too frequent, not too rare)

## 📊 Debugging Tips

### Check Extension Logs:
1. Go to `chrome://extensions/`
2. Click "Service worker" link under Flowstate extension
3. Opens DevTools for service worker
4. Check console for errors

### Check Backend Logs:
- All events are logged to console
- WebSocket connections show up immediately
- Pattern detection logs when triggered
- Interventions log before sending

### Check Database:
```bash
# Using sqlite3 (if installed)
sqlite3 backend/data/flowstate.db

# Check sessions
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;

# Check activities
SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 20;

# Check insights
SELECT * FROM insights ORDER BY generated_at DESC LIMIT 5;
```

## 🚀 Next Steps After Testing

Once you've verified everything works:

1. **Report any issues** with:
   - Extension behavior
   - WebSocket stability
   - Pattern detection accuracy
   - Intervention quality
   - Performance issues

2. **Frontend UI** can be built next to visualize:
   - Real-time session metrics
   - Live focus score
   - Intervention notifications
   - Activity timeline

3. **Demo data** can be seeded for presentations

4. **Error handling** polish can be added based on edge cases found

---

**Happy Testing!** 🎉
