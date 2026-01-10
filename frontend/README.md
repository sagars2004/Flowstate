# Flowstate Frontend

React 18 + Vite + TypeScript + Tailwind CSS frontend application for Flowstate productivity intelligence system.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Real-Time**: Socket.io-client
- **Charts**: Recharts (to be added)
- **Icons**: Lucide React (to be added)

## Development

### Install Dependencies

From the root of the monorepo:
```bash
npm install
```

### Start Development Server

From the root:
```bash
npm run dev:frontend
```

Or from this directory:
```bash
npm run dev
```

The app will open at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
src/
├── context/           # React Context providers
│   ├── SessionContext.tsx
│   └── WebSocketContext.tsx
├── pages/             # Route pages
│   ├── Dashboard.tsx
│   ├── LiveSession.tsx
│   ├── SessionReport.tsx
│   └── Landing.tsx
├── services/          # API and external services
│   └── api.ts
├── App.tsx            # Root component with routing
├── main.tsx           # Entry point
└── index.css          # Global styles with Tailwind
```

## Environment Variables

Copy `env.example` to `.env`:
```bash
cp env.example .env
```

Available variables:
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)
- `VITE_WS_URL` - WebSocket server URL (default: http://localhost:3001)

## Routes

- `/` - Dashboard (session overview)
- `/live/:sessionId` - Live session monitoring
- `/report/:sessionId` - Post-session analytics report
- `/welcome` - Landing/onboarding page

## Features Status

- ✅ Vite + React + TypeScript setup
- ✅ Tailwind CSS configuration
- ✅ React Router setup
- ✅ Session Context (global state)
- ✅ WebSocket Context (real-time connection)
- ✅ API service (Axios)
- ✅ Basic page scaffolding
- ⏳ Component library (upcoming)
- ⏳ Data visualization (upcoming)
- ⏳ Real-time features (upcoming)
