# Pattern Recognition Engine

This module provides intelligent pattern detection and focus score calculation for Flowstate sessions.

## Architecture

### PatternDetector (`PatternDetector.ts`)
Detects four types of distraction patterns:

1. **Context Switching** - Excessive tab/app switching
2. **Social Media Spiral** - Repeated visits to social platforms
3. **Extended Idle** - Long periods of inactivity
4. **Fragmented Focus** - Many short work bursts instead of sustained focus

Each pattern includes:
- Type classification
- Severity level (low/medium/high)
- Descriptive explanation
- Metadata for analysis

### FocusScoreCalculator (`FocusScoreCalculator.ts`)
Calculates a comprehensive focus score (0-100) based on four components:

1. **Typing Consistency (40%)** - Steady rhythm indicates flow state
2. **Low Context Switching (30%)** - Fewer switches = deeper focus
3. **Minimal Idle (20%)** - Active engagement matters
4. **Site Focus (10%)** - Time on productive vs distracting sites

### PatternAnalysisService (`PatternAnalysisService.ts`)
Orchestrates pattern detection and focus scoring, providing:
- Complete session analysis
- Real-time pattern detection
- Actionable recommendations
- Trend calculation vs historical data

## Usage

### Analyze a Completed Session

```typescript
import { PatternAnalysisService } from './patterns';

const analysisService = new PatternAnalysisService();
const result = await analysisService.analyzeSession(session, activities);

console.log(result.focusScore.overall); // 85.5
console.log(result.patterns); // [{ type: 'context_switching', severity: 'medium', ... }]
console.log(result.recommendations); // ["Try the 'One Tab Rule'...", ...]
```

### Real-Time Pattern Detection

```typescript
// Detect patterns in the last 5 minutes of activity
const recentPatterns = await analysisService.analyzeRealtime(last5MinActivities);

if (recentPatterns.length > 0) {
  // Trigger intervention
  const pattern = recentPatterns[0];
  console.log(`Detected ${pattern.type} (${pattern.severity})`);
}
```

### Auto-Calculate Focus Score

```typescript
// When ending a session, focus score is calculated automatically
await sessionService.endSession(sessionId); // No focus score needed!

// Or provide a manual override
await sessionService.endSession(sessionId, 90.0);
```

### Get Session Analysis

```typescript
// Get full analysis via API
GET /api/sessions/:id/analysis

// Response includes:
{
  "id": "...",
  "focusScore": 85.5,
  "analysis": {
    "patterns": [...],
    "focusScore": {
      "typingConsistency": 92,
      "lowContextSwitching": 78,
      "minimalIdle": 85,
      "siteFocus": 90,
      "overall": 85.5
    },
    "summary": { ... },
    "recommendations": [...]
  }
}
```

## Pattern Detection Logic

### Context Switching
**Triggers when:** 8+ tab switches in 5 minutes  
**Severity:**
- Low: 8-12 switches
- Medium: 12-16 switches  
- High: 16+ switches

**Example:**
```typescript
{
  type: 'context_switching',
  severity: 'high',
  description: '15 tab switches in 5 minutes across 8 different sites',
  metadata: {
    switchCount: 15,
    uniqueUrls: 8,
    windowMinutes: 5
  }
}
```

### Social Media Spiral
**Triggers when:** 3+ visits to social platforms in 5 minutes  
**Severity:**
- Low: 3-4 visits
- Medium: 5-9 visits
- High: 10+ visits

**Detected domains:** Twitter, Facebook, Instagram, Reddit, TikTok, YouTube, LinkedIn

### Extended Idle
**Triggers when:** Idle period > 30 seconds  
**Severity:**
- Low: 30-120 seconds
- Medium: 2-5 minutes
- High: 5+ minutes

### Fragmented Focus
**Triggers when:** High switch-to-typing ratio (>0.5)  
**Severity:**
- Low: 0.5-0.8 ratio
- Medium: 0.8-1.5 ratio
- High: 1.5+ ratio

## Focus Score Components

### 1. Typing Consistency (40% weight)
Measures rhythm steadiness using coefficient of variation (CV):
- **CV ≤ 0.2**: Excellent (100) - Very consistent typing
- **CV = 0.35**: Good (70) - Some variation
- **CV ≥ 0.5**: Poor (0) - Highly inconsistent

### 2. Low Context Switching (30% weight)
Based on switches per hour:
- **0-5**: Excellent (100)
- **5-15**: Good (70-100)
- **15-30**: Moderate (40-70)
- **30+**: Poor (0-40)

### 3. Minimal Idle (20% weight)
Based on idle percentage of session:
- **0-10%**: Excellent (100) - Highly engaged
- **10-20%**: Good (80-100) - Healthy breaks
- **20-40%**: Moderate (50-80)
- **40%+**: Poor (0-50)

### 4. Site Focus (10% weight)
Based on productive vs distracting site ratio:
- **70%+ productive**: Excellent (100)
- **40-70% productive**: Good (70-100)
- **50%+ distracting**: Poor (0-30)

**Productive domains:** GitHub, Stack Overflow, Google Docs, Notion, Figma, etc.  
**Distracting domains:** Twitter, Facebook, Netflix, YouTube, etc.

## Configuration

### Customize Detection Thresholds

```typescript
import { PatternDetector, DEFAULT_PATTERN_CONFIG } from './patterns';

const detector = new PatternDetector({
  ...DEFAULT_PATTERN_CONFIG,
  contextSwitchThreshold: 10, // Increase threshold
  idleThresholdExtended: 600, // 10 minutes instead of 5
});
```

### Customize Focus Score Weights

```typescript
import { FocusScoreCalculator, DEFAULT_FOCUS_SCORE_CONFIG } from './patterns';

const calculator = new FocusScoreCalculator({
  ...DEFAULT_FOCUS_SCORE_CONFIG,
  weights: {
    typingConsistency: 0.5, // Increase to 50%
    lowContextSwitching: 0.3,
    minimalIdle: 0.15,
    siteFocus: 0.05,
  },
});
```

### Add Custom Site Lists

```typescript
const config = {
  ...DEFAULT_FOCUS_SCORE_CONFIG,
  productiveDomains: [
    ...DEFAULT_FOCUS_SCORE_CONFIG.productiveDomains,
    'mycompany.atlassian.net',
    'mycompany.slack.com',
  ],
};
```

## Integration with AI

Pattern detection feeds into AI interventions:

```typescript
import { AIService } from '../ai';
import { PatternAnalysisService } from '../patterns';

const patterns = await patternAnalysis.analyzeRealtime(activities);

if (patterns.length > 0 && patterns[0].severity === 'high') {
  // Generate AI intervention
  const intervention = await aiService.generateIntervention(patterns[0]);
  // Send to user via WebSocket
  socket.emit('intervention', intervention);
}
```

## Recommendations Engine

The system generates tailored recommendations based on detected patterns:

| Pattern | Recommended Techniques |
|---------|----------------------|
| Context Switching | One Tab Rule, Pomodoro, Time-blocking |
| Social Media Spiral | Website blockers, Scheduled check-ins |
| Extended Idle | Idle alerts, Explicit break timers |
| Fragmented Focus | Task batching, Implementation intentions |

## Performance

- **Pattern Detection**: ~5ms for 1000 activities
- **Focus Score Calculation**: ~3ms for 1000 activities
- **Full Analysis**: ~10ms total

All calculations are synchronous and designed for real-time use.

## Testing

```bash
# Create a session with varied activity
curl -X POST http://localhost:3001/api/sessions
# Log activities...
# Get full analysis
curl http://localhost:3001/api/sessions/:id/analysis
```

See `TESTING.md` for complete test scenarios.

## Future Enhancements

- [ ] Machine learning for personalized thresholds
- [ ] Time-of-day pattern detection
- [ ] Workload intensity classification
- [ ] Team aggregate patterns (privacy-safe)
- [ ] Custom pattern types
- [ ] A/B testing for interventions
