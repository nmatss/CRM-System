# ZippiCRM — contexto do projeto

> Este arquivo substitui o contexto legado do protótipo "Moda CRM". As referências antigas a React 18, PostgreSQL, `connect-pg-simple` e integrações prontas com OpenAI, Stripe ou Nodemailer não correspondem ao código atual.

## Visão geral

ZippiCRM é um CRM multi-tenant para varejo. O produto reúne cadastro de clientes, catálogo, vendas, cashback, campanhas, automações, agenda e metas de vendedores, relatórios, importação e exportação.

O repositório é um monorepo TypeScript. Frontend, backend e contratos compartilhados ficam no mesmo projeto.

## Preferência de comunicação

Use linguagem simples e direta.

## Stack verificada

### Frontend

- React 19 e TypeScript;
- Vite 8;
- Wouter para rotas;
- TanStack Query para estado remoto;
- Tailwind CSS 4;
- componentes shadcn/ui baseados em Radix UI;
- React Hook Form e Zod;
- Recharts e Framer Motion.

### Backend

- Node.js 20 e npm 10;
- Express 4 e TypeScript executado com `tsx` em desenvolvimento;
- API REST principal sob `/api/v1/*` e health check em `/api/health`;
- autenticação por sessão com cookie HTTP-only;
- autorização por papéis e associação ao tenant no servidor;
- proteção CSRF nas rotas privadas e limitadores de requisição;
- Drizzle ORM com SQLite via `better-sqlite3`;
- sessões persistidas em SQLite por `better-sqlite3-session-store`.

### Qualidade e build

- TypeScript para verificação estática;
- ESLint e Prettier;
- Vitest e Testing Library;
- esbuild para o bundle do servidor;
- GitHub Actions para instalação reproduzível, typecheck, testes com cobertura, build e auditoria das dependências de runtime.

## Estrutura principal

```text
client/src/          frontend React
server/              API, autenticação, persistência e serviços
shared/              schemas e contratos compartilhados
migrations/          migrations incrementais do SQLite
script/              build
scripts/             utilitários operacionais
docs/                documentação técnica e operacional
```

## Decisões observadas no código

1. Frontend e backend compartilham tipos por `shared/`.
2. Os aliases `@/` e `@shared/` apontam para o frontend e os contratos compartilhados.
3. O armazenamento de dados e o armazenamento de sessões usam arquivos SQLite separados e configuráveis.
4. Recursos de negócio autenticados devem derivar usuário, papel e tenant da sessão; valores enviados pelo cliente não substituem a autorização do servidor.
5. A aplicação de desenvolvimento integra o Vite ao Express; a produção serve os artefatos compilados.

## Limites atuais e protótipos

- Os canais de notificação por email, SMS e WhatsApp não possuem provedor configurado. O serviço falha de forma explícita, sem simular entrega.
- Campanhas e automações possuem cadastro e operações de domínio, mas não equivalem a uma plataforma externa de envio ou a um worker de execução em produção.
- O atalho `wa.me` no frontend apenas abre uma conversa no WhatsApp; não é uma integração de API.
- Componentes apresentados como assistente de IA devem ser tratados como interface/protótipo enquanto não houver um serviço verificável no backend.
- O pacote atual não configura integrações operacionais com OpenAI, Stripe ou Nodemailer.

## Fontes de consulta

- [README principal](./README.md): instalação e visão geral do repositório.
- [Índice de documentação](./docs/README.md): estado e escopo dos documentos técnicos.
- [Banco de dados](./docs/DATABASE.md): snapshot documentado do modelo de dados.
- [API](./docs/API_README.md): guia parcial para consumidores.
- [Deploy](./DEPLOY.md): implantação e variáveis operacionais.
- [Backup e restauração](./BACKUP_RESTORE.md): procedimentos para SQLite.
- [Runbook](./RUNBOOK_PRODUCAO.md): operação e resposta a incidentes.
- [Segurança](./SECURITY.md): controles implementados e checklist de produção.

O código e os testes são a fonte de verdade para o comportamento executável. Documentos de API e banco podem representar snapshots parciais e devem ser atualizados junto com mudanças de contrato.
