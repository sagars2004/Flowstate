# Flowstate Backend

Express.js + TypeScript + SQLite backend for Flowstate productivity intelligence system.

## Tech Stack

- **Framework**: Express.js with TypeScript
- **Database**: SQLite3 (local-first)
- **Real-Time**: Socket.io (to be added)
- **AI**: Groq SDK (to be added)
- **Validation**: Express Validator
- **Security**: Helmet, CORS

## Development

### Install Dependencies

From the root of the monorepo:
```bash
npm install
```

### Setup Environment

Copy environment variables:
```bash
cd backend
cp env.example .env
```

Edit `.env` and configure as needed.

### Run Database Migrations

```bash
npm run db:migrate
```

This will create the SQLite database and all tables.

### Start Development Server

From the root:
```bash
npm run dev:backend
```

Or from this directory:
```bash
npm run dev
```

The server will start on `http://localhost:3001` with auto-reload enabled.

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Project Structure

```
src/
├── db/                    # Database setup
│   ├── database.ts       # Database connection
│   ├── schema.sql        # Database schema
│   └── migrate.ts        # Migration script
├── repositories/          # Data access layer
│   ├── BaseRepository.ts
│   ├── SessionRepository.ts
│   └── ActivityRepository.ts
├── services/              # Business logic (to be added)
├── routes/                # API routes (to be added)
├── middleware/            # Express middleware
│   ├── errors.ts         # Custom error classes
│   └── errorHandler.ts   # Error handler middleware
└── server.ts              # Server entry point
```

## Database Schema

### Tables

- **sessions**: Focus session records
- **activity_logs**: Activity events (tab switches, typing, idle, etc.)
- **insights**: AI-generated insights and recommendations

See `src/db/schema.sql` for complete schema definition.

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Sessions (to be added)
- `POST /api/sessions/start` - Start new session
- `POST /api/sessions/:id/end` - End session
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions` - List sessions
- `DELETE /api/sessions/:id` - Delete session

### Activities (to be added)
- `POST /api/activity` - Log activity event
- `POST /api/activity/batch` - Log multiple activities
- `GET /api/activity/session/:sessionId` - Get session activities

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - SQLite database file path
- `CORS_ORIGIN` - Allowed CORS origin (default: http://localhost:5173)
- `GROQ_API_KEY` - Groq API key (to be added)

## Features Status

- ✅ Express server setup
- ✅ SQLite database connection
- ✅ Database schema and migrations
- ✅ Repository pattern (Session, Activity)
- ✅ Custom error classes
- ✅ Error handler middleware
- ✅ CORS and security headers
- ⏳ REST API routes (next step)
- ⏳ Socket.io integration (upcoming)
- ⏳ Groq AI integration (upcoming)
- ⏳ Pattern recognition engine (upcoming)

## Testing

Health check:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T...",
  "uptime": 123.45
}
```
