#!/bin/bash

# AutoManim Setup Script

cat << "EOF"
    ___         __        __  ___            _
   /   | __  __/ /_____  /  |/  /___ _____  (_)___ ___
  / /| |/ / / / __/ __ \/ /|_/ / __ `/ __ \/ / __ `__ \
 / ___ / /_/ / /_/ /_/ / /  / / /_/ / / / / / / / / / /
/_/  |_\__,_/\__/\____/_/  /_/\__,_/_/ /_/_/_/ /_/ /_/

EOF

echo "Welcome to AutoManim Setup!"
echo "---------------------------"

# 1. Python Environment Setup
echo "Select your Python environment manager:"
echo "1) pip (venv) - Default"
echo "2) conda"
echo "3) uv"
read -p "Enter choice [1-3]: " env_choice

setup_venv() {
    echo "Creating python venv..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing backend requirements..."
    pip install -r backend/requirements.txt
}

setup_conda() {
    echo "Creating conda environment 'automanim'..."
    conda create -n automanim python=3.9 -y
    
    # Check if conda activate works in shell script, often requires eval
    # Trying minimal approach, otherwise warn user
    eval "$(conda shell.bash hook)"
    conda activate automanim
    
    echo "Installing backend requirements..."
    pip install -r backend/requirements.txt
    
    echo ""
    echo "NOTE: To run the app later, you must run 'conda activate automanim' manually before run.sh"
}

setup_uv() {
    echo "Creating uv venv..."
    uv venv --python 3.9
    source .venv/bin/activate
    echo "Installing backend requirements..."
    uv pip install -r backend/requirements.txt
}

case $env_choice in
    2)
        setup_conda
        ;;
    3)
        setup_uv
        ;;
    *)
        setup_venv
        ;;
esac

echo "---------------------------"

# 2. Frontend Setup
echo "Setting up Frontend..."
cd frontend

# Set env var
echo "Creating .env.local..."
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > .env.local

echo "Installing npm dependencies..."
npm install

cd ..

echo "---------------------------"
echo "Setup Complete! 🎉"
echo "To run the app:"
echo "  ./run.sh"
