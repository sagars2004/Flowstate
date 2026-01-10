import React from 'react';
import { useSession } from '../context/SessionContext';

export default function Dashboard(): JSX.Element {
  const { isSessionActive, currentSession } = useSession();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your focus, understand your patterns
          </p>
        </div>

        {/* Status Card */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Session Status
          </h2>
          {isSessionActive ? (
            <div className="text-green-600 dark:text-green-400">
              ✓ Active session running (ID: {currentSession?.id})
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">
              No active session. Start a session from the Chrome extension.
            </div>
          )}
        </div>

        {/* Quick Stats Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Today's Focus Score
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              -- <span className="text-lg text-gray-500">/100</span>
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Deep Work Time
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              -- <span className="text-lg text-gray-500">min</span>
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Sessions Today
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              0
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Getting Started
          </h3>
          <p className="text-blue-800 dark:text-blue-200">
            Install the Flowstate Chrome extension and start your first focus session to begin tracking your productivity patterns.
          </p>
        </div>
      </div>
    </div>
  );
}
