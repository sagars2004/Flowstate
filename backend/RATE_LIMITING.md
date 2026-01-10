# Rate Limiting Implementation

## Overview

Comprehensive rate limiting system to prevent exceeding Groq API limits and ensure reliable operation within free tier constraints.

## Components

### 1. GroqRateLimiter (`backend/src/ai/rateLimiter.ts`)

Token bucket algorithm implementation that:
- Tracks available tokens (default: 5000 TPM)
- Limits requests per minute (default: 25 RPM)
- Throttles interventions per session (min 10 minutes between interventions)
- Automatically refills tokens over time

**Key Features:**
- Token-based limiting (prevents exceeding TPM limits)
- Request-based limiting (prevents exceeding RPM limits)
- Per-session intervention throttling
- Automatic token refill

### 2. RequestQueue (`backend/src/ai/requestQueue.ts`)

Queue system that:
- Queues API requests when rate limited
- Processes queue when capacity is available
- Implements exponential backoff for retries
- Prioritizes requests (fast model = higher priority)

**Key Features:**
- Automatic queuing when rate limited
- Exponential backoff retry logic
- Priority-based processing
- Max queue size protection (default: 50)

### 3. Enhanced GroqClient (`backend/src/ai/GroqClient.ts`)

Updated to:
- Use rate limiter and queue for all API calls
- Handle 429 rate limit errors gracefully
- Extract retry-after headers from errors
- Provide rate limit stats for monitoring

**Key Features:**
- All API calls go through rate limiter
- Automatic retry with exponential backoff
- Better error messages for rate limits
- Stats endpoint for monitoring

### 4. WebSocket Handler Throttling (`backend/src/websocket/socketHandler.ts`)

Added per-session throttling:
- Minimum 10 minutes between interventions per session
- Prevents spam when patterns are detected frequently
- Clears throttle when session ends

## Configuration

### Default Limits (Conservative)

```typescript
{
  tokensPerMinute: 5000,    // Well below 6000 TPM free tier limit
  requestsPerMinute: 25,    // Well below ~30 RPM typical limit
  burstSize: 5,             // Max burst requests
  minInterventionInterval: 10 * 60 * 1000  // 10 minutes
}
```

### Environment Variables

You can adjust limits via environment variables (future enhancement):
- `GROQ_RATE_LIMIT_TPM` - Tokens per minute
- `GROQ_RATE_LIMIT_RPM` - Requests per minute
- `GROQ_MIN_INTERVENTION_INTERVAL` - Minimum seconds between interventions

## How It Works

### Request Flow

1. **API Call Requested**
   ```
   GroqClient.generateFast() → RequestQueue.enqueue()
   ```

2. **Rate Limit Check**
   ```
   RequestQueue → GroqRateLimiter.acquire()
   - Checks available tokens
   - Checks request rate
   - Returns true/false
   ```

3. **If Rate Limited**
   ```
   Request added to queue
   → Wait for capacity
   → Retry automatically
   ```

4. **If Allowed**
   ```
   Execute API call
   → On 429 error: Extract retry-after
   → Retry with exponential backoff
   → Return result or error
   ```

### Intervention Flow

1. **Pattern Detected**
   ```
   Activity logged → analyzePatternAndIntervene()
   ```

2. **Throttle Check**
   ```
   Check last intervention time for session
   → If < 10 minutes: Skip
   → If >= 10 minutes: Proceed
   ```

3. **Generate Intervention**
   ```
   AIService.generateIntervention()
   → GroqClient.generateFast() (rate limited)
   → Queue if needed
   → Return intervention message
   ```

4. **Send Intervention**
   ```
   Record intervention time
   → Send via WebSocket
   → Update throttle map
   ```

## Monitoring

### Health Check Endpoint

```bash
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T...",
  "uptime": 123.45,
  "groq": {
    "enabled": true,
    "rateLimit": {
      "availableTokens": 4850,
      "queueSize": 2,
      "timeUntilNextRequest": 0
    }
  }
}
```

### Logging

Rate limiting events are logged:
- `⏳ Rate limit: Too many requests. Wait Xs`
- `⏳ Rate limit: Not enough tokens. Need X, have Y. Wait Zs`
- `⚠️  Intervention generation rate limited for session X. Will retry later.`
- `Intervention throttled for session X: Ys remaining`

## Error Handling

### Rate Limit Errors (429)

1. **Automatic Detection**
   - Checks error message for "429", "rate_limit"
   - Checks response status code

2. **Retry Logic**
   - Extracts `retry-after` header if available
   - Uses exponential backoff (5s, 10s, 20s)
   - Max 3 retries per request

3. **Graceful Degradation**
   - Interventions are skipped (not failed)
   - Post-session analysis can wait
   - System continues operating

### Model Deprecation Errors

- Automatically falls back to 8B model
- Logs helpful warnings
- Continues operation

## Best Practices

1. **Monitor Rate Limit Stats**
   - Check `/health` endpoint regularly
   - Watch for queue buildup
   - Adjust limits if needed

2. **Intervention Frequency**
   - Default: Max 1 per 10 minutes per session
   - Adjust based on user feedback
   - Consider user preferences

3. **Token Estimation**
   - Default: 200 tokens per request
   - Adjust based on actual usage
   - Monitor token consumption

4. **Queue Management**
   - Max queue size prevents memory issues
   - Old requests are rejected if queue full
   - Consider increasing if needed

## Testing

### Test Rate Limiting

```bash
# Generate many rapid requests
for i in {1..30}; do
  curl -X POST http://localhost:3001/api/insights/SESSION_ID &
done

# Check health endpoint for queue size
curl http://localhost:3001/health | jq .groq.rateLimit
```

### Test Intervention Throttling

1. Start a session
2. Trigger multiple patterns quickly (rapid tab switching)
3. Should only receive 1 intervention per 10 minutes
4. Check logs for throttling messages

## Troubleshooting

### Queue Building Up

**Symptoms**: `queueSize` keeps growing in health check

**Solutions**:
- Reduce intervention frequency
- Increase rate limits (if upgraded tier)
- Check for stuck requests

### Rate Limits Hit Frequently

**Symptoms**: Many "Rate limit" warnings in logs

**Solutions**:
- Reduce `requestsPerMinute` in config
- Increase `MIN_INTERVENTION_INTERVAL`
- Check for multiple sessions generating interventions

### Interventions Not Appearing

**Possible Causes**:
1. Rate limited (check logs)
2. Throttled (wait 10 minutes)
3. No patterns detected
4. AI service disabled (no GROQ_API_KEY)

**Debug**:
- Check backend logs
- Check `/health` endpoint
- Verify GROQ_API_KEY is set

## Future Enhancements

- [ ] Configurable limits via environment variables
- [ ] Per-user rate limiting (if multi-user)
- [ ] Rate limit metrics dashboard
- [ ] Adaptive rate limiting based on API responses
- [ ] User preferences for intervention frequency
