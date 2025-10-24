#!/bin/bash
# Start the Physical Risk Interpolation Microservice

cd "$(dirname "$0")"

echo "Starting Physical Risk Interpolation Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Start the service
echo "Service starting on http://localhost:5001"
python app.py
