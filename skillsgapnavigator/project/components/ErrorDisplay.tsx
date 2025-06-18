
import React from 'react';
import { ApiError } from '../types';

interface ErrorDisplayProps {
  error: ApiError | null;
  onRetry?: () => void;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, className = '' }) => {
  if (!error) return null;

  return (
    <div className={`p-4 my-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow ${className}`} role="alert">
      <div className="flex items-center">
        <svg className="w-6 h-6 mr-2 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M10 0C4.486 0 0 4.486 0 10s4.486 10 10 10 10-4.486 10-10S15.514 0 10 0zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-5h2v2H9v-2zm0-8h2v6H9V5z"/>
        </svg>
        <strong className="font-bold">Error:</strong>
      </div>
      <p className="ml-8">{error.message}</p>
      {error.details && <p className="ml-8 mt-1 text-sm">{error.details}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 ml-8 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorDisplay;
