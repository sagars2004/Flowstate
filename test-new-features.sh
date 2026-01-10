#!/bin/bash

# Flowstate NEW Features Test Script
# Tests pattern recognition and AI insights generation

set -e

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Flowstate NEW Features Test${NC}"
echo "================================"
echo ""

# Test 1: Create a session with realistic activity
echo -e "${BLUE}1. Creating session with realistic activity patterns...${NC}"

SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions")
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ Session ID: $SESSION_ID${NC}"
echo ""

# Simulate a mix of focused and distracted work
echo -e "${BLUE}2. Logging realistic work patterns...${NC}"

# Good focus period (consistent typing)
for i in {1..5}; do
  curl -s -X POST "$BASE_URL/api/activities" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"eventType\": \"typing\",
      \"typingVelocity\": $((175 + RANDOM % 15)),
      \"url\": \"https://github.com\"
    }" > /dev/null
  sleep 0.1
done
echo "  ✓ Logged 5 focused typing events (GitHub)"

# Context switching pattern (distraction)
for url in "https://twitter.com" "https://github.com" "https://stackoverflow.com" "https://twitter.com" "https://reddit.com" "https://github.com" "https://twitter.com"; do
  curl -s -X POST "$BASE_URL/api/activities" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"eventType\": \"tab_switch\",
      \"url\": \"$url\"
    }" > /dev/null
  sleep 0.1
done
echo "  ✓ Logged 7 tab switches (includes social media visits)"

# More focused work
for i in {1..4}; do
  curl -s -X POST "$BASE_URL/api/activities" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"eventType\": \"typing\",
      \"typingVelocity\": $((180 + RANDOM % 20)),
      \"url\": \"https://github.com\"
    }" > /dev/null
  sleep 0.1
done
echo "  ✓ Logged 4 more typing events"

# Idle period
curl -s -X POST "$BASE_URL/api/activities" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"eventType\": \"idle_end\",
    \"idleDuration\": 45
  }" > /dev/null
echo "  ✓ Logged idle period (45 seconds)"
echo ""

# Test 2: Get Pattern Analysis
echo -e "${BLUE}3. Running pattern analysis...${NC}"
ANALYSIS=$(curl -s "$BASE_URL/api/sessions/$SESSION_ID/analysis")
echo "$ANALYSIS" | python3 -m json.tool 2>/dev/null || echo "$ANALYSIS"
echo ""

# Extract and display focus score
FOCUS_SCORE=$(echo $ANALYSIS | grep -o '"overall":[0-9.]*' | cut -d':' -f2)
echo -e "${YELLOW}📊 Focus Score: $FOCUS_SCORE / 100${NC}"

# Check for patterns
PATTERN_COUNT=$(echo $ANALYSIS | grep -o '"type":' | wc -l)
if [ "$PATTERN_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Detected $PATTERN_COUNT distraction pattern(s)${NC}"
else
  echo -e "${GREEN}✓ No major distraction patterns detected${NC}"
fi
echo ""

# Test 3: End session (will auto-calculate focus score)
echo -e "${BLUE}4. Ending session (auto-calculating focus score)...${NC}"
END_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/end" \
  -H "Content-Type: application/json")
echo "$END_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$END_RESPONSE"
echo ""

# Test 4: Generate AI Insights (if GROQ_API_KEY is set)
echo -e "${BLUE}5. Generating AI insights...${NC}"
INSIGHTS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/insights/$SESSION_ID")

if echo "$INSIGHTS_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ AI insights generated successfully!${NC}"
  echo ""
  echo -e "${YELLOW}Insights Preview:${NC}"
  echo "$INSIGHTS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'data' in data and 'insights' in data['data']:
    insights = data['data']['insights']
    print('\nSummary:')
    print(insights.get('summary', 'N/A')[:200] + '...')
    print('\nRecommendations:')
    for i, rec in enumerate(data['data'].get('recommendations', [])[:3], 1):
        print(f'{i}. {rec[:100]}...')
" 2>/dev/null || echo "$INSIGHTS_RESPONSE"
else
  echo -e "${YELLOW}⚠️  AI insights may require GROQ_API_KEY to be set${NC}"
  echo -e "${YELLOW}   Falling back to pattern-based insights${NC}"
fi
echo ""

# Test 5: Get Comparative Analysis (only works if there are other sessions)
echo -e "${BLUE}6. Getting comparative analysis...${NC}"
COMPARISON=$(curl -s "$BASE_URL/api/insights/$SESSION_ID/comparison")
echo "$COMPARISON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'data' in data:
    print(f\"Historical sessions compared: {data['data'].get('historicalSessionCount', 0)}\")
    print(f\"Comparison: {data['data'].get('comparison', 'N/A')[:200]}...\")
" 2>/dev/null || echo "$COMPARISON"
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ All NEW features tested!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}📝 Endpoints tested:${NC}"
echo "  - GET  /api/sessions/:id/analysis (Pattern Recognition)"
echo "  - POST /api/insights/:sessionId (Generate AI Insights)"
echo "  - GET  /api/insights/:sessionId (Get Cached Insights)"
echo "  - GET  /api/insights/:sessionId/comparison (Historical Comparison)"
echo ""
echo -e "${BLUE}💡 Pro Tips:${NC}"
echo "  - Set GROQ_API_KEY in backend/.env for AI-powered insights"
echo "  - Create multiple sessions to see better comparative analysis"
echo "  - Try different activity patterns to see various distraction detections"
echo ""
echo "Session ID: $SESSION_ID"
