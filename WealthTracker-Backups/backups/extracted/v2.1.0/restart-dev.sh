#!/bin/bash

# Kill any existing Vite processes
pkill -f "vite" 2>/dev/null

# Wait a moment for the process to fully terminate
sleep 1

# Start the dev server in the background
npm run dev &

# Give it a moment to start
sleep 2

echo "Development server restarted and running at http://localhost:5173"