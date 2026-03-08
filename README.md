<p align="center">
  <h1 align="center">CRM-System</h1>
  <p align="center">CRM completo para varejo com cashback, relatorios, automacoes e integracoes nativas com ERPs</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

---

## Sobre o Projeto

CRM-System e um sistema de gestao de relacionamento com clientes voltado para o varejo. Possui suporte multi-tenant, programa de cashback, automacoes, campanhas para vendedores, relatorios avancados e design responsivo com tema claro/escuro.

## Arquitetura

Aplicacao fullstack com frontend React e backend Express servidos pelo mesmo processo:

```
client/        # Frontend React + Vite
server/        # Backend Express + Drizzle ORM
shared/        # Schema e tipos compartilhados
migrations/    # Migrations do banco de dados
```

## Funcionalidades

- **Multi-tenant** - Multiplas empresas com login isolado
- **Gestao de Clientes** - Cadastro completo com segmentacao
- **Pedidos e Vendas** - Controle de pedidos e historico
- **Produtos** - Catalogo com gestao de estoque
- **Programa de Cashback** - Fidelizacao de clientes
- **Campanhas para Vendedores** - Metas e incentivos
- **Automacoes** - Fluxos automatizados de comunicacao
- **Relatorios** - Dashboards interativos com graficos
- **Agenda do Vendedor** - Gestao de atividades e follow-ups
- **Painel Administrativo** - Gestao de tenants e usuarios
- **Autenticacao Segura** - Passport.js com CSRF protection
- **Design Responsivo** - Tema claro/escuro com Shadcn/UI
- **Testes Automatizados** - Vitest com coverage

## Stack Tecnologica

**Backend:** TypeScript, Express, Drizzle ORM, SQLite (better-sqlite3), Passport.js, Zod, bcrypt

**Frontend:** React 19, Vite, Tailwind CSS 4, React Query, Wouter, Recharts, React Hook Form, Radix UI, Framer Motion, Lucide Icons

**Testes:** Vitest, Testing Library, Supertest

**Deploy:** Docker, Railway, Render.com

## Como Executar

### Pre-requisitos

- Node.js 18+

### Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/nmatss/CRM-System.git
cd CRM-System

# Copiar variaveis de ambiente
cp .env.example .env
# Editar o .env com suas credenciais

# Instalar dependencias
npm install

# Criar banco de dados
npm run db:push

# Iniciar em desenvolvimento
npm run dev
```

A aplicacao estara disponivel em `http://localhost:5000`.

### Com Docker

```bash
docker compose up -d
```

## Variaveis de Ambiente

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_PATH` | Caminho do banco SQLite (padrao: `./data/zippcrm.db`) |
| `PORT` | Porta do servidor (padrao: 5000) |
| `NODE_ENV` | Ambiente (`development` / `production`) |
| `SESSION_SECRET` | Segredo para sessoes (obrigatorio em producao) |
| `ADMIN_EMAIL` | Email do super admin inicial |
| `ADMIN_PASSWORD` | Senha do super admin inicial |

Consulte o arquivo `.env.example` para a lista completa e guias de deploy.

## Scripts Disponiveis

```bash
npm run dev              # Inicia servidor em modo dev
npm run build            # Build de producao
npm run start            # Inicia em producao
npm run check            # Verificacao de tipos TypeScript
npm run test             # Rodar testes
npm run test:coverage    # Testes com cobertura
npm run db:push          # Sincronizar schema com banco
npm run db:generate      # Gerar migrations
npm run db:studio        # Abrir Drizzle Studio
```

## Deploy

O projeto suporta deploy em:

- **Render.com** - Configuracao via `render.yaml`
- **Railway** - Configuracao via `railway.toml`
- **Docker** - Via `Dockerfile` e `docker-compose.yml`

## Licenca

MIT
