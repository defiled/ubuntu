#!/bin/bash

# Cross-Border Payment API - Setup Script

set -e

echo "🚀 Setting up Cross-Border Payment API..."
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.x LTS"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ Node.js $(node --version)"
echo "✅ pnpm $(pnpm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install
echo ""

# Check PostgreSQL
echo "Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed"
    echo "Please install PostgreSQL 16:"
    echo "  macOS: brew install postgresql@16"
    echo "  Linux: sudo apt-get install postgresql-16"
    echo "  Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16"
    echo ""
else
    echo "✅ PostgreSQL installed"
fi

# Check Redis
echo "Checking Redis..."
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis is not installed"
    echo "Please install Redis 7.x:"
    echo "  macOS: brew install redis"
    echo "  Linux: sudo apt-get install redis-server"
    echo "  Docker: docker run -d -p 6379:6379 redis:7-alpine"
    echo ""
else
    echo "✅ Redis installed"

    # Test Redis connection
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Start it with:"
        echo "  macOS: brew services start redis"
        echo "  Linux: sudo systemctl start redis"
        echo "  Docker: docker start <container-id>"
    fi
fi
echo ""

# Setup environment
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your database credentials"
else
    echo "✅ .env.local already exists"
fi
echo ""

# Database setup
echo "🗄️  Setting up database..."
echo "Running migrations..."
pnpm db:migrate || echo "⚠️  Migration failed. Make sure PostgreSQL is running and DATABASE_URL is correct"
echo ""

echo "Generating Prisma Client..."
pnpm db:generate
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your database credentials (if needed)"
echo "  2. Start dev server: pnpm dev"
echo "  3. Start workers: pnpm workers (in separate terminal)"
echo "  4. Open http://localhost:3000/wallet"
echo ""
