import React from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocketContext } from '../context/WebSocketContext';

export default function LiveSession(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { isConnected } = useWebSocketContext();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Live Session
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Session ID: {sessionId}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">
            Live session monitoring will be implemented in upcoming steps.
          </p>
        </div>
      </div>
    </div>
  );
}
