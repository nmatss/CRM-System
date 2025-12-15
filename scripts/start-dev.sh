#!/bin/bash

# ZippiCRM Development Startup Script
# This script starts the database and the application

set -e

echo "🚀 ZippiCRM - Iniciando ambiente de desenvolvimento..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado!${NC}"
    echo ""
    echo "Por favor, instale o Docker Desktop e ative a integração WSL2:"
    echo "1. Baixe: https://www.docker.com/products/docker-desktop"
    echo "2. Settings → Resources → WSL Integration → Ative sua distro"
    echo "3. Reinicie o terminal e execute este script novamente"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker não está rodando. Iniciando...${NC}"
    echo "Por favor, abra o Docker Desktop e aguarde ele iniciar."
    exit 1
fi

echo -e "${GREEN}✓ Docker encontrado${NC}"

# Start PostgreSQL container
echo ""
echo "📦 Iniciando banco de dados PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Aguardando banco de dados ficar pronto..."
until docker-compose exec -T postgres pg_isready -U zippcrm -d zippcrm &> /dev/null; do
    sleep 1
done
echo -e "${GREEN}✓ Banco de dados pronto${NC}"

# Run database migrations
echo ""
echo "🔄 Aplicando schema do banco de dados..."
npm run db:push

echo ""
echo -e "${GREEN}✅ Ambiente pronto!${NC}"
echo ""
echo "📊 Banco de dados: localhost:5432"
echo "🔑 Usuário: zippcrm"
echo "🔐 Senha: zippcrm123"
echo "📁 Database: zippcrm"
echo ""
echo "🌐 Adminer (interface web): http://localhost:8080"
echo ""
echo "Para iniciar a aplicação, execute:"
echo -e "${YELLOW}npm run dev${NC}"
