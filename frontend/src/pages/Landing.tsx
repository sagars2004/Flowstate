import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Welcome to Flowstate
        </h1>
        <p className="text-xl text-primary-100 mb-12">
          AI-powered focus companion that adapts to your rhythm and doesn't treat productivity like a metronome.
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Getting Started
          </h2>
          <ol className="text-left space-y-4 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center mr-3">
                1
              </span>
              <span>Install the Flowstate Chrome extension</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center mr-3">
                2
              </span>
              <span>Start your first focus session from the extension</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center mr-3">
                3
              </span>
              <span>Let AI learn your unique productivity patterns</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center mr-3">
                4
              </span>
              <span>Receive timely interventions and insights</span>
            </li>
          </ol>
          
          <div className="mt-8">
            <Link to="/" className="btn-primary inline-block">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
