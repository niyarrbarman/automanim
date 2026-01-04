#!/bin/bash

# Function to kill all background processes on exit
cleanup() {
    echo "Stopping AutoManim..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting AutoManim..."

# Try to activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -n "$CONDA_DEFAULT_ENV" ]; then
    echo "Using active conda environment: $CONDA_DEFAULT_ENV"
else
    echo "Warning: No venv found and no conda environment active."
    echo "Please ensure your python dependencies are installed."
fi

# 1. Start Backend
echo "Starting Backend (http://localhost:8000)..."
uvicorn app.main:app --app-dir backend --reload &

# 2. Start Frontend
echo "Starting Frontend (http://localhost:3000)..."
npm run dev --prefix frontend &

# Wait for both processes
wait
