<p align="center">
  <h1 align="center">CRM-System</h1>
  <p align="center">CRM completo para varejo com cashback, relatorios, automacoes, agenda comercial e operacao multi-tenant</p>
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

O banco oficial atual do runtime e SQLite via `better-sqlite3`. PostgreSQL e integrações ERP devem ser tratados como evolucoes futuras, nao como dependencias operacionais atuais.

## Arquitetura

Aplicacao fullstack com frontend React e backend Express servidos pelo mesmo processo:

```
client/        # Frontend React + Vite
server/        # Backend Express + Drizzle ORM
shared/        # Schema e tipos compartilhados
migrations/    # Migrations do banco de dados
```

## Funcionalidades

- **Multi-tenant** - Empresas isoladas, com o tenant e a membership revalidados a cada requisicao
- **Gestao de Clientes** - Cadastro, segmentacao, importacao/exportacao e visao 360 com dados reais
- **Pedidos e Vendas** - Itens com snapshot de preco e baixa de estoque na mesma transacao
- **Produtos** - Catalogo com estoque, busca, filtros e paginacao no servidor
- **Programa de Cashback** - Ledger em centavos com credito, debito FIFO, expiracao, reversao e reconciliacao
- **Campanhas** - Envio por outbox duravel, com status por destinatario e respeito a opt-out
- **Automacoes** - Definicao versionada, execucao idempotente por evento e historico auditavel
- **Relatorios** - Agregacao a partir dos itens de pedido, em centavos e com timezone explicito
- **Agenda do Vendedor** - Tarefas, metas, interacoes e ranking
- **Painel Administrativo** - Gestao de tenants e usuarios com audit log imutavel
- **Autenticacao Segura** - Sessao HTTP-only, bcrypt, rate limit, CSRF e senha de 12+ caracteres
- **Design Responsivo** - Tema claro/escuro com Shadcn/UI
- **Testes Automatizados** - Vitest com cobertura sob threshold na CI

### Ainda nao disponivel

Estas capacidades nao estao operacionais e o sistema declara isso em vez de
simular sucesso:

- envio real por email, SMS ou WhatsApp: enquanto nao houver provedor
  configurado, cada destinatario e registrado como `not_configured` e nada e
  enviado;
- metricas de abertura, conversao e receita de campanha, que dependem de
  eventos de atribuicao ainda nao coletados;
- testes end-to-end de navegador, auditoria de acessibilidade e regressao
  visual;
- error tracking, metricas e alertas de producao.

## Stack Tecnologica

**Backend:** TypeScript, Express, Drizzle ORM, SQLite (better-sqlite3), sessoes server-side, Zod, bcrypt

**Frontend:** React 19, Vite, Tailwind CSS 4, React Query, Wouter, Recharts, React Hook Form, Radix UI, Framer Motion, Lucide Icons

**Testes:** Vitest, Testing Library, Supertest

**Deploy:** Docker, Railway, Render.com

## Como Executar

### Pre-requisitos

- Node.js **20.19.x** e npm **10.8.x**, fixados em `package.json`, `.nvmrc` e
  `.node-version`. O modulo nativo `better-sqlite3` e compilado para essa ABI:
  em outra versao de Node os testes falham ao carregar o banco. Com `fnm` ou
  `nvm`, rode `fnm use` (ou `nvm use`) na raiz do repositorio antes de instalar.

### Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/nmatss/CRM-System.git
cd CRM-System

# Copiar variaveis de ambiente
cp .env.example .env
# Editar o .env com suas credenciais

# Instalar dependencias reproduziveis
npm ci

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

| Variavel                                                | Descricao                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`                                         | Caminho do banco SQLite (padrao: `./data/zippcrm.db`)                                             |
| `PORT`                                                  | Porta do servidor (padrao: 5000)                                                                  |
| `NODE_ENV`                                              | Ambiente (`development` / `production`)                                                           |
| `TRUST_PROXY`                                           | Defina `1` apenas atras de proxy/PaaS confiavel; deixe vazio em Docker direto                     |
| `SESSION_SECRET`                                        | Segredo para sessoes; obrigatorio em producao, minimo 32 caracteres, nao usar placeholder         |
| `ADMIN_EMAIL`                                           | Email valido do super admin inicial; obrigatorio em producao                                      |
| `ADMIN_PASSWORD`                                        | Senha do super admin inicial; obrigatoria em producao, minimo 12 caracteres, nao usar placeholder |
| `ALLOW_EMPTY_DATABASE_BOOTSTRAP`                        | `true` apenas no primeiro boot controlado de um volume vazio; volte para `false` em seguida       |
| `EMAIL_PROVIDER` / `SMS_PROVIDER` / `WHATSAPP_PROVIDER` | Habilitam cada canal de entrega. Vazio significa canal indisponivel e nenhuma mensagem enviada    |
| `OUTBOX_WORKER_ENABLED`                                 | `false` para o processo parar de reivindicar jobs; os jobs continuam persistidos                  |

Consulte o arquivo `.env.example` para a lista completa e guias de deploy.

## Scripts Disponiveis

```bash
npm run dev              # Inicia servidor em modo dev
npm run build            # Build de producao
npm run start            # Inicia em producao
npm run check            # Verificacao de tipos TypeScript
npm run lint             # ESLint sem warnings tolerados
npm run format:check     # Prettier em modo verificacao
npm run docs:check       # Valida os links da documentacao
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
- **Docker** - Via `Dockerfile` e `docker-compose.yml`, com volume persistente para `/app/data`

Documentos operacionais:

- `DEPLOY.md`
- `BACKUP_RESTORE.md`
- `RUNBOOK_PRODUCAO.md`
- `GO_LIVE_CHECKLIST.md`

## Licenca

MIT
