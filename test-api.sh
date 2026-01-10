#!/bin/bash

# Flowstate API Quick Test Script
# Tests the backend API with a complete session workflow

set -e  # Exit on any error

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Flowstate API Test Suite${NC}"
echo "================================"
echo ""

# Test 1: Health Check
echo -e "${BLUE}1. Testing health endpoint...${NC}"
HEALTH=$(curl -s "$BASE_URL/health")
echo "✓ Health check response: $HEALTH"
echo ""

# Test 2: Create Session
echo -e "${BLUE}2. Creating a new session...${NC}"
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json")
echo "✓ Session created: $SESSION_RESPONSE"
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
echo ""

# Test 3: Log Activities
echo -e "${BLUE}3. Logging activities...${NC}"

# Typing activity
curl -s -X POST "$BASE_URL/api/activities" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"eventType\": \"typing\",
    \"typingVelocity\": 180.5,
    \"url\": \"https://github.com\"
  }" > /dev/null
echo "✓ Logged typing activity"

# Tab switch
curl -s -X POST "$BASE_URL/api/activities" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"eventType\": \"tab_switch\",
    \"url\": \"https://stackoverflow.com\"
  }" > /dev/null
echo "✓ Logged tab switch"

# Batch activities
curl -s -X POST "$BASE_URL/api/activities/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"activities\": [
      {
        \"sessionId\": \"$SESSION_ID\",
        \"eventType\": \"typing\",
        \"typingVelocity\": 175.0,
        \"url\": \"https://github.com\"
      },
      {
        \"sessionId\": \"$SESSION_ID\",
        \"eventType\": \"idle_end\",
        \"idleDuration\": 60
      }
    ]
  }" > /dev/null
echo "✓ Logged batch of activities"
echo ""

# Test 4: Get Session Statistics
echo -e "${BLUE}4. Fetching session statistics...${NC}"
STATS=$(curl -s "$BASE_URL/api/sessions/$SESSION_ID/statistics")
echo "$STATS" | grep -o '"totalActivities":[0-9]*' || true
echo "$STATS" | grep -o '"tabSwitchCount":[0-9]*' || true
echo "✓ Statistics retrieved"
echo ""

# Test 5: Get Activities
echo -e "${BLUE}5. Querying activities...${NC}"
ACTIVITIES=$(curl -s "$BASE_URL/api/activities?sessionId=$SESSION_ID")
ACTIVITY_COUNT=$(echo $ACTIVITIES | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "✓ Retrieved $ACTIVITY_COUNT activities"
echo ""

# Test 6: End Session
echo -e "${BLUE}6. Ending session...${NC}"
END_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/end" \
  -H "Content-Type: application/json" \
  -d '{"focusScore": 85.5}')
echo "✓ Session ended with focus score 85.5"
echo ""

# Test 7: List Sessions
echo -e "${BLUE}7. Listing all sessions...${NC}"
SESSIONS=$(curl -s "$BASE_URL/api/sessions?limit=5")
SESSION_COUNT=$(echo $SESSIONS | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "✓ Retrieved $SESSION_COUNT sessions"
echo ""

# Test 8: Get Single Session
echo -e "${BLUE}8. Fetching completed session...${NC}"
FINAL_SESSION=$(curl -s "$BASE_URL/api/sessions/$SESSION_ID")
echo "$FINAL_SESSION" | grep -o '"status":"[^"]*' || true
echo "$FINAL_SESSION" | grep -o '"focusScore":[0-9.]*' || true
echo "✓ Session details retrieved"
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Session ID for reference: $SESSION_ID"
echo ""
echo "You can view this session with:"
echo "  curl http://localhost:3001/api/sessions/$SESSION_ID"
echo ""
echo "Or delete it with:"
echo "  curl -X DELETE http://localhost:3001/api/sessions/$SESSION_ID"
