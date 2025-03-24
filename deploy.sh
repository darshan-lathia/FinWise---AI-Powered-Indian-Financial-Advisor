#!/bin/bash

# FinWise Deployment Script
# Usage: ./deploy.sh [environment]

set -e

# Default environment is production
ENVIRONMENT=${1:-production}
VALID_ENVIRONMENTS=("development" "production")

# Check if the environment is valid
if [[ ! " ${VALID_ENVIRONMENTS[@]} " =~ " ${ENVIRONMENT} " ]]; then
    echo "Error: Invalid environment. Valid options are: ${VALID_ENVIRONMENTS[*]}"
    exit 1
fi

echo "🚀 Starting FinWise deployment for ${ENVIRONMENT} environment"

# Setup environment files
echo "📝 Setting up environment files"
cp client-react/.env.${ENVIRONMENT} client-react/.env
cp server-python/.env.${ENVIRONMENT} server-python/.env

# Install dependencies and build frontend
echo "🔧 Building frontend"
cd client-react
npm ci
npm run build
cd ..

# Install dependencies for backend
echo "🐍 Setting up backend"
cd server-python
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..

# Create Docker image if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Building Docker image"
    docker build -t finwise:${ENVIRONMENT} .
    
    echo "📋 Docker image built successfully. You can run it with:"
    echo "   docker run -p 9000:9000 finwise:${ENVIRONMENT}"
else
    echo "⚠️ Docker not found - skipping Docker image build"
fi

# Start the application using the finwise.sh script
if [ -f "finwise.sh" ]; then
    echo "🚀 Starting the application"
    ./finwise.sh restart
else
    echo "⚠️ finwise.sh not found - cannot start the application automatically"
    echo "🔍 You can start the application manually:"
    echo "   cd server-python && python app.py"
fi

echo "✅ Deployment complete for ${ENVIRONMENT} environment" 