# Flowstate Backend API Documentation

## Base URL
`http://localhost:3001/api`

## Authentication
Currently, no authentication is required. This will be added in a future iteration.

---

## Session Endpoints

### Create Session
**POST** `/sessions`

Create a new focus session.

**Request Body** (optional):
```json
{
  "startTime": "2024-01-10T10:00:00Z" // Optional, defaults to current time
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "startTime": "2024-01-10T10:00:00.000Z",
    "endTime": null,
    "focusScore": null,
    "status": "active",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T10:00:00.000Z"
  }
}
```

---

### Get All Sessions
**GET** `/sessions`

Retrieve all sessions with optional filtering.

**Query Parameters**:
- `limit` (number, 1-100): Maximum number of sessions to return
- `offset` (number, ≥0): Offset for pagination
- `status` (string): Filter by status (`active`, `completed`, `abandoned`)
- `startDate` (ISO 8601): Filter sessions starting after this date
- `endDate` (ISO 8601): Filter sessions starting before this date

**Example**: `/sessions?limit=10&status=completed&startDate=2024-01-01T00:00:00Z`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-v4",
      "startTime": "2024-01-10T10:00:00.000Z",
      "endTime": "2024-01-10T11:30:00.000Z",
      "focusScore": 85.5,
      "status": "completed",
      "createdAt": "2024-01-10T10:00:00.000Z",
      "updatedAt": "2024-01-10T11:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Get Session by ID
**GET** `/sessions/:id`

Retrieve a single session by its UUID.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "startTime": "2024-01-10T10:00:00.000Z",
    "endTime": "2024-01-10T11:30:00.000Z",
    "focusScore": 85.5,
    "status": "completed",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T11:30:00.000Z"
  }
}
```

**Error** (404 Not Found):
```json
{
  "status": "error",
  "message": "Session {id} not found",
  "name": "NotFoundError"
}
```

---

### Get Session with Statistics
**GET** `/sessions/:id/statistics`

Retrieve a session with aggregated statistics.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "startTime": "2024-01-10T10:00:00.000Z",
    "endTime": "2024-01-10T11:30:00.000Z",
    "focusScore": 85.5,
    "status": "completed",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T11:30:00.000Z",
    "statistics": {
      "totalActivities": 342,
      "totalTypingTime": 3420000,
      "totalIdleTime": 180000,
      "tabSwitchCount": 12
    }
  }
}
```

---

### End Session
**PATCH** `/sessions/:id/end`

Mark a session as completed and set its focus score.

**Request Body**:
```json
{
  "focusScore": 85.5 // Required, 0-100
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "startTime": "2024-01-10T10:00:00.000Z",
    "endTime": "2024-01-10T11:30:00.000Z",
    "focusScore": 85.5,
    "status": "completed",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T11:30:00.000Z"
  }
}
```

---

### Delete Session
**DELETE** `/sessions/:id`

Delete a session and all its associated activities.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Session uuid-v4 deleted"
}
```

---

## Activity Endpoints

### Log Single Activity
**POST** `/activities`

Log a single activity event.

**Request Body**:
```json
{
  "sessionId": "uuid-v4", // Required
  "timestamp": "2024-01-10T10:05:00Z", // Optional, defaults to current time
  "eventType": "typing", // Required: tab_switch | typing | idle_start | idle_end | app_switch
  "url": "https://github.com", // Optional, sanitized URL
  "typingVelocity": 180.5, // Optional, characters per minute
  "idleDuration": 60, // Optional, seconds (for idle_end events)
  "metadata": {} // Optional, additional event-specific data
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 123,
    "sessionId": "uuid-v4",
    "timestamp": "2024-01-10T10:05:00.000Z",
    "eventType": "typing",
    "url": "https://github.com",
    "typingVelocity": 180.5,
    "idleDuration": null,
    "metadata": {},
    "createdAt": "2024-01-10T10:05:00.000Z"
  }
}
```

---

### Log Activity Batch
**POST** `/activities/batch`

Log multiple activities at once (more efficient for bulk operations).

**Request Body**:
```json
{
  "activities": [
    {
      "sessionId": "uuid-v4",
      "timestamp": "2024-01-10T10:05:00Z",
      "eventType": "typing",
      "url": "https://github.com",
      "typingVelocity": 180.5
    },
    {
      "sessionId": "uuid-v4",
      "timestamp": "2024-01-10T10:06:00Z",
      "eventType": "tab_switch",
      "url": "https://twitter.com"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Successfully logged 2 activities",
  "count": 2
}
```

---

### Get Activities
**GET** `/activities`

Retrieve activities for a specific session.

**Query Parameters**:
- `sessionId` (UUID, required): Session ID to filter by
- `eventType` (string, optional): Filter by event type

**Example**: `/activities?sessionId=uuid-v4&eventType=typing`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "sessionId": "uuid-v4",
      "timestamp": "2024-01-10T10:05:00.000Z",
      "eventType": "typing",
      "url": "https://github.com",
      "typingVelocity": 180.5,
      "idleDuration": null,
      "metadata": {},
      "createdAt": "2024-01-10T10:05:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation error: focusScore must be between 0 and 100",
  "name": "ValidationError"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Session {id} not found",
  "name": "NotFoundError"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "An unexpected error occurred.",
  "name": "InternalServerError"
}
```

---

## Event Types

| Event Type | Description | Required Fields |
|------------|-------------|----------------|
| `typing` | User is actively typing | `typingVelocity` |
| `tab_switch` | User switched to a different tab | `url` |
| `idle_start` | User became idle | - |
| `idle_end` | User returned from idle state | `idleDuration` |
| `app_switch` | User switched to a different application | `metadata` |

---

## Testing the API

### Using curl

```bash
# Create a session
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json"

# Get all sessions
curl http://localhost:3001/api/sessions

# Log an activity
curl -X POST http://localhost:3001/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-uuid",
    "eventType": "typing",
    "typingVelocity": 180.5,
    "url": "https://github.com"
  }'

# End a session
curl -X PATCH http://localhost:3001/api/sessions/your-session-uuid/end \
  -H "Content-Type: application/json" \
  -d '{"focusScore": 85.5}'
```

### Health Check

```bash
curl http://localhost:3001/health
```
