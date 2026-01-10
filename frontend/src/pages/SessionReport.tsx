import React from 'react';
import { useParams } from 'react-router-dom';

export default function SessionReport(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Session Report
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Session ID: {sessionId}
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">
            Session report with analytics and insights will be implemented in upcoming steps.
          </p>
        </div>
      </div>
    </div>
  );
}
