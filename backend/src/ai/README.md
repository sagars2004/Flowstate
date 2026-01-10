# Flowstate AI Integration

This directory contains the Groq AI integration for Flowstate, powering real-time interventions and post-session insights.

## Architecture

### GroqClient (`GroqClient.ts`)
Low-level wrapper around the Groq SDK, providing:
- **`generateFast()`**: Uses Llama 3.1 8B Instant for real-time responses (<500ms)
- **`generateDeep()`**: Uses Llama 3.1 70B Versatile for comprehensive analysis
- **`generateWithHistory()`**: Supports multi-turn conversations with context

### PromptTemplates (`PromptTemplates.ts`)
Carefully engineered prompts for different AI interactions:
- **`realtimeIntervention()`**: Generates supportive "tap on shoulder" messages
- **`postSessionAnalysis()`**: Creates comprehensive session reports
- **`techniqueRecommendations()`**: Suggests evidence-based focus techniques
- **`comparativeAnalysis()`**: Compares performance against historical data
- **`focusStateDescription()`**: Assesses current focus state

All prompts follow **privacy-first principles**: only behavioral patterns, never content.

### AIService (`AIService.ts`)
High-level service layer that orchestrates AI operations:
- Wraps GroqClient with domain-specific logic
- Parses structured responses from LLM outputs
- Handles errors gracefully
- Provides clean TypeScript interfaces

## Privacy & Security

### What We DON'T Send to AI:
❌ Typed content  
❌ Full URLs (only sanitized hostnames)  
❌ Personal identifiers  
❌ Auth tokens or credentials  

### What We DO Send:
✅ Behavioral patterns (tab switch frequency, typing velocity)  
✅ Sanitized URLs (e.g., `github.com`, not full paths)  
✅ Timing data (when events occurred)  
✅ Aggregated statistics  

## Usage Examples

### Real-Time Intervention

```typescript
import { AIService } from './ai';

const pattern: DistractionPattern = {
  type: 'context_switching',
  severity: 'high',
  description: '8 tab switches in 5 minutes, including 3 visits to Twitter',
};

const intervention = await aiService.generateIntervention(pattern);
console.log(intervention.message);
// "I noticed you've been hopping between a few different sites..."
```

### Post-Session Analysis

```typescript
const insights = await aiService.generateSessionInsights(session, activities, summary);

console.log(insights.summary);
// "Strong session overall with 85% active engagement..."

console.log(insights.recommendations);
// "Based on your patterns, try the 'One Tab Rule'..."
```

### Focus State Assessment

```typescript
const recentActivities = getLastNActivities(10);
const focusState = await aiService.assessFocusState(recentActivities, 5);

console.log(focusState);
// "State: Deep focus - Steady typing, no interruptions"
```

## Model Selection Strategy

### Llama 3.1 8B Instant (Fast Model)
**Use for:**
- Real-time interventions during active sessions
- Quick focus state assessments
- Technique recommendations
- Any interaction requiring <500ms response

**Characteristics:**
- Speed: ~200-400ms
- Max tokens: 150-800
- Temperature: 0.7 (balanced creativity)

### Llama 3.1 70B Versatile (Deep Model)
**Use for:**
- Post-session comprehensive analysis
- Nuanced comparative insights
- Complex pattern recognition
- Multi-dimensional feedback

**Characteristics:**
- Speed: ~1-3s
- Max tokens: 800-1000
- Temperature: 0.7 (balanced creativity)

## Prompt Engineering Principles

1. **Specificity**: Clear, detailed instructions with examples
2. **Constraint**: Explicit output format requirements
3. **Context**: Sufficient data without overwhelming
4. **Tone**: Warm, supportive, growth-oriented coaching
5. **Privacy**: Never request or include personal content

## Error Handling

All AI methods handle errors gracefully:

```typescript
try {
  const intervention = await aiService.generateIntervention(pattern);
} catch (error) {
  // Falls back to default intervention message
  // Logs error for monitoring
  // Never breaks user experience
}
```

## Configuration

Set these environment variables in `.env`:

```bash
GROQ_API_KEY=gsk_...
GROQ_MODEL_8B=llama-3.1-8b-instant
GROQ_MODEL_70B=llama-3.1-70b-versatile
GROQ_MAX_TOKENS=1000
GROQ_TEMPERATURE=0.7
```

## Testing AI Features

### Without API Key
If `GROQ_API_KEY` is not set, AI features gracefully degrade:
- Server starts normally with warning
- AI-dependent features return fallback messages
- Core functionality (tracking, stats) works fine

### With API Key
Get a free Groq API key at [console.groq.com](https://console.groq.com)

Test with:

```bash
curl -X POST http://localhost:3001/api/ai/test-intervention \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": {
      "type": "context_switching",
      "severity": "high",
      "description": "Frequent tab switches detected"
    }
  }'
```

## Rate Limiting

Groq's free tier provides:
- ~14,400 requests/day (Llama 3.1 8B)
- ~5,000 requests/day (Llama 3.1 70B)

For production, implement:
1. User-level rate limiting (max N interventions per session)
2. Caching for repeated patterns
3. Batching for post-session analysis

## Future Enhancements

- [ ] Add caching layer for common patterns
- [ ] Implement user-level rate limiting
- [ ] Add A/B testing for prompt variations
- [ ] Build feedback loop for intervention effectiveness
- [ ] Add multi-language support
- [ ] Implement personalized coaching styles
