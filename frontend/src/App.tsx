import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Dashboard from './pages/Dashboard';
import LiveSession from './pages/LiveSession';
import SessionReport from './pages/SessionReport';
import Landing from './pages/Landing';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

function App(): JSX.Element {
  return (
    <Router>
      <WebSocketProvider url={WS_URL}>
        <SessionProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live/:sessionId" element={<LiveSession />} />
            <Route path="/report/:sessionId" element={<SessionReport />} />
            <Route path="/welcome" element={<Landing />} />
          </Routes>
        </SessionProvider>
      </WebSocketProvider>
    </Router>
  );
}

export default App;
