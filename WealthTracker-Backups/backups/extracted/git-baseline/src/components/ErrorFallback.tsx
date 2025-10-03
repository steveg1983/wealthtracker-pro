import { AlertCircleIcon as AlertCircle } from './icons';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps): React.JSX.Element {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-center text-gray-900">
          Something went wrong
        </h3>
        <p className="mt-2 text-sm text-center text-gray-600">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={resetError}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
