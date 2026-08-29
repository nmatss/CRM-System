#!/bin/bash

# ZippiCRM Development Startup Script
# This script prepares the local SQLite database used by the application.

set -e

echo "🚀 ZippiCRM - Preparando ambiente de desenvolvimento..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não encontrado.${NC}"
    exit 1
fi

mkdir -p data

echo ""
echo "🔄 Sincronizando schema SQLite..."
npm run db:push

echo ""
echo -e "${GREEN}✅ Ambiente pronto!${NC}"
echo ""
echo "📊 Banco SQLite: ${DATABASE_PATH:-./data/zippcrm.db}"
echo ""
echo "Para iniciar a aplicação, execute:"
echo -e "${YELLOW}npm run dev${NC}"
