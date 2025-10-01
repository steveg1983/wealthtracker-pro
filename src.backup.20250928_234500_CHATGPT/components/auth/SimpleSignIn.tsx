import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";

export default function SimpleSignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to WealthTracker
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The #1 personal finance app
          </p>
        </div>
        
        <SignedOut>
          <div className="space-y-4">
            <SignInButton mode="modal">
              <button className="w-full py-3 px-4 bg-gradient-to-r from-gray-500 to-indigo-600 text-white rounded-xl font-medium hover:from-gray-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all shadow-lg">
                Sign In
              </button>
            </SignInButton>
            
            <SignUpButton mode="modal">
              <button className="w-full py-3 px-4 border-2 border-gray-500 text-gray-600 dark:text-gray-500 rounded-xl font-medium hover:bg-blue-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all">
                Create Account
              </button>
            </SignUpButton>
          </div>
        </SignedOut>
        
        <SignedIn>
          <div className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">You're signed in!</p>
            <UserButton afterSignOutUrl="/" />
            <a 
              href="/dashboard" 
              className="block w-full py-3 px-4 bg-gradient-to-r from-gray-500 to-indigo-600 text-white rounded-xl font-medium hover:from-gray-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all shadow-lg"
            >
              Go to Dashboard
            </a>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}