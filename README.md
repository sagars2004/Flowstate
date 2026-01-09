# Flowstate

Local-first productivity intelligence system that uses behavioral metadata and adaptive AI interventions to personalize and sustain deep focus.

## Project Structure

This is a TypeScript monorepo using npm workspaces, containing four packages:

```
Flowstate/
├── frontend/          # React + Vite frontend
├── backend/           # Express.js backend + SQLite
├── extension/         # Chrome Extension (Manifest V3)
├── shared/            # Shared TypeScript types
├── docs/              # Documentation (PRD, RFCs, Features)
└── package.json       # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Flowstate
```

2. Install dependencies for all workspaces:
```bash
npm install
```

This will install dependencies for all workspaces (frontend, backend, extension, shared).

### Development

Run all services in development mode:
```bash
npm run dev
```

Or run individual workspaces:
```bash
npm run dev:frontend   # Start Vite dev server (port 5173)
npm run dev:backend    # Start Express server (port 3001)
npm run dev:extension  # Build extension in watch mode
```

### Building

Build all workspaces:
```bash
npm run build
```

Or build individually:
```bash
npm run build:frontend
npm run build:backend
npm run build:extension
```

### Type Checking

Run TypeScript type checking across all workspaces:
```bash
npm run type-check
```

## Workspaces

### Frontend (`@flowstate/frontend`)
- **Tech**: React 18, Vite, TypeScript, Tailwind CSS, Recharts
- **Port**: 5173 (dev)
- **Entry**: `frontend/src/main.tsx`

### Backend (`@flowstate/backend`)
- **Tech**: Express.js, TypeScript, SQLite, Socket.io, Groq SDK
- **Port**: 3001
- **Entry**: `backend/src/server.ts`

### Extension (`@flowstate/extension`)
- **Tech**: TypeScript, Chrome Manifest V3, Socket.io-client
- **Build**: Webpack
- **Entry**: `extension/src/background/serviceWorker.ts`

### Shared (`@flowstate/shared`)
- **Tech**: TypeScript
- **Purpose**: Shared types and utilities used across all workspaces

## Documentation

- **PRD**: `docs/PRD.md` - Product requirements and specifications
- **Features**: `docs/FEATURES.md` - Detailed feature documentation
- **RFCs**: `docs/rfcs/` - Technical RFCs for each major feature
- **Cursor Rules**: `.cursorrules` - Development standards and patterns

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Socket.io-client
- **Backend**: Express.js, TypeScript, SQLite3, Socket.io, Groq SDK (Llama 3.1)
- **Extension**: Chrome Manifest V3, TypeScript, WebSocket
- **Build Tools**: Vite (frontend), tsx (backend), Webpack (extension)
- **Monorepo**: npm workspaces

## License

Apache-2.0
