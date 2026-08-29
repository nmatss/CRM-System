# Plano mestre de conclusao do CRM-System

**Status:** Fases 0 a 9 concluidas; Fase 10 executada ate o limite do que nao exige o ambiente final. Nenhum P0 permanece aberto.

**Checkpoint:** 2026-08-29 (revisado apos a implementacao das Fases 0-9)

> A secao 2 preserva a auditoria original de 2026-08-29 09:42 como registro
> historico. O estado atual verificado esta na secao 2.1.

**Fonte de verdade analisada:** worktree local atual, incluindo alteracoes ainda nao commitadas
**Diretorio:** `/home/nic20/ProjetosWeb/Meus_Projetos/02-crm-system`

## 1. Objetivo e criterio de encerramento

Este documento organiza o trabalho necessario para transformar a base atual em um produto funcional, seguro, testavel, operavel e retomavel. O projeto nao deve ser declarado concluido apenas porque todas as telas existem.

O programa termina somente quando:

1. nao houver dados mockados apresentados como dados reais;
2. autenticacao, autorizacao e isolamento entre tenants tiverem testes positivos e negativos;
3. os modulos declarados no escopo tiverem fluxo de negocio completo, e nao somente CRUD visual;
4. contratos HTTP, schema, migrations e documentacao estiverem sincronizados;
5. CI, observabilidade, backup, restore, rollback e go-live tiverem evidencia executavel;
6. todos os gates deste plano estiverem aprovados e as pendencias fora do escopo estiverem explicitamente registradas.

## 2. Baseline observado e validado

### Stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, Wouter, Radix/shadcn e Recharts.
- Backend: Express 4, TypeScript, Drizzle ORM, Zod, bcrypt e sessoes server-side.
- Banco oficial atual: SQLite com `better-sqlite3`; PostgreSQL nao faz parte do runtime atual.
- Testes: Vitest, Testing Library e Supertest.
- Deploy descrito: Docker, Render e Railway.
- Package manager: npm com `package-lock.json`.
- Runtime oficial observado: Node 20 no Docker; o repositorio ainda nao fixa a versao para shells e PaaS.

### Evidencias desta auditoria

| Gate                                            | Resultado | Observacao                                                      |
| ----------------------------------------------- | --------- | --------------------------------------------------------------- |
| `npm run check`                                 | passou    | TypeScript sem erros no snapshot atual                          |
| `npm test -- --run` no Node 24                  | falhou    | falha ambiental: `better-sqlite3` instalado para ABI do Node 20 |
| `fnm exec --using=20.20.2 -- npm test -- --run` | passou    | 4 arquivos, 63 testes                                           |
| cobertura no Node 20                            | passou    | 8,29% statements; 5,47% branches; 3,97% functions; 8,51% lines  |
| `npm run build`                                 | passou    | cliente e servidor gerados                                      |
| smoke de producao com banco temporario          | passou    | health retornou `healthy` e banco `connected`                   |
| `docker compose config --quiet`                 | passou    | configuracao valida com valores descartaveis                    |
| build Docker em auditoria paralela              | passou    | `docker build --check` e build sem imagem final                 |
| backup/restore descartavel                      | passou    | integridade `ok`, zero FKs invalidas e 19 tabelas restauradas   |
| `npm audit --omit=dev --audit-level=high`       | falhou    | 1 alta em `ip-address`; 1 baixa em `body-parser`                |

O build e os testes aprovados provam apenas que o snapshot compila e que os 63 testes existentes passam no runtime correto. A cobertura de 8,29% e a ausencia de E2E nao permitem afirmar que os fluxos de negocio funcionam integralmente.

### Inventario quantitativo

- 15 paginas roteadas no frontend;
- 89 declaracoes de rota no router `/api/v1`, mais health e emissao de token CSRF, totalizando 91 operacoes HTTP observadas;
- 19 tabelas no schema SQLite atual;
- OpenAPI com 11 paths e 17 operacoes, deixando 74 operacoes observadas sem documentacao no contrato;
- arquivos centrais acima do tamanho sustentavel: `server/routes.ts` com cerca de 3 mil linhas e `server/storage.ts` com mais de 1,1 mil linhas.

As contagens sao do snapshot auditado e devem ganhar uma verificacao automatica na Fase 2 para evitar nova divergencia.

## 2.1 Estado atual verificado

Gates executados no runtime fixado (Node 20.19.0, npm 10.8.2):

| Gate                                      | Resultado | Evidencia                                                                         |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `npm run check`                           | passou    | TypeScript sem erros                                                              |
| `npm run lint`                            | passou    | `eslint . --max-warnings=0`                                                       |
| `npm run format:check`                    | passou    | Prettier limpo em todo o repositorio                                              |
| `npm run docs:check`                      | passou    | 70 links validados                                                                |
| `npm test -- --run`                       | passou    | 34 arquivos, 210 testes                                                           |
| `npm run test:coverage -- --run`          | passou    | 27,8% statements; thresholds em 27/22/20/27                                       |
| `npx playwright test`                     | passou    | 40 testes de navegador                                                            |
| `npm run build`                           | passou    | cliente e servidor gerados                                                        |
| `npm audit --omit=dev --audit-level=high` | passou    | 0 vulnerabilidades                                                                |
| smoke de producao com banco descartavel   | passou    | health com identidade de build, ready, 401, 404 JSON, CSP/HSTS, shutdown gracioso |
| guard de bootstrap com banco vazio        | passou    | processo recusa iniciar e nao abre porta                                          |
| backup + restore descartavel              | passou    | integridade `ok`, manifesto com SHA-256, retencao aplicada, app sobe do backup    |
| `docker build --check` e build da imagem  | passou    | imagem com a tag do commit                                                        |
| ciclo de container                        | passou    | boot com flag, stop gracioso, restart com flag `false` no mesmo volume            |
| migrations 0004-0008 em copia descartavel | passou    | upgrade aditivo, guards cross-tenant e contencao                                  |
| carga com 4.000 clientes e 4.000 pedidos  | passou    | listagem 1,1 ms; relatorio do mes 32 ms; dashboard 27 ms                          |

Inventario atual:

- 83 paths no OpenAPI e 100% das operacoes publicadas documentadas, com teste de
  paridade bidirecional na CI;
- 28 tabelas no schema SQLite, migrations 0004 a 0008 aplicadas;
- `server/routes.ts` reduzido de 4.045 para 102 linhas, com 25 modulos por
  dominio; contrato de storage extraido para `server/storage/contracts.ts`.

## 3. Estado do produto por modulo

Estado revisado apos a implementacao das Fases 0 a 6.

| Modulo                     | Estado atual                | O que existe                                                                                          | O que falta para conclusao                                                 |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Landing e captacao         | parcial                     | landing, contato e demo persistidos                                                                   | antispam, consentimento/privacidade, workflow de lead e links legais reais |
| Autenticacao               | concluida                   | login CPF/email, sessao persistente, CSRF, rate limit, senha 12+, email normalizado unico, audit log  | E2E por papel                                                              |
| Multi-tenancy              | concluida                   | contexto revalidado por request, allowlist de update, guards cross-tenant no banco                    | E2E de revogacao no navegador                                              |
| Super Admin                | avancado                    | CRUD transacional, audit log, diagnosticos de banco e outbox                                          | soft-delete/retencao decididos e E2E de permissoes                         |
| Equipe/configuracoes       | avancado                    | settings, gestao de equipe e reset seguro                                                             | perfil/preferencias persistidos                                            |
| Clientes                   | concluida                   | CRUD, import/export, busca e paginacao server-side, consentimento de marketing                        | deduplicacao no import                                                     |
| Produtos                   | concluida                   | CRUD, import/export, paginacao e filtros server-side, precos em centavos                              | dry-run de importacao                                                      |
| Pedidos                    | concluida                   | itens com snapshot, ID server-side, estoque transacional, cancelamento idempotente                    | associacao de vendedor em todos os fluxos                                  |
| Cashback                   | concluida                   | ledger FIFO em centavos, credito/debito idempotentes, expiracao, reversao e reconciliacao             | resgate pela UI do vendedor                                                |
| Campanhas                  | concluida na infraestrutura | execucoes e destinatarios persistidos, consentimento, outbox idempotente, retry e dead-letter         | provider real, agendamento futuro, webhooks e atribuicao                   |
| Automacoes                 | concluida                   | definicao versionada, gatilhos e acoes em allowlist, execucoes idempotentes, historico real           | mais gatilhos e acoes conforme a demanda                                   |
| Notificacoes               | infraestrutura pronta       | adapters fail-closed sem PII em log, entrega registrada por destinatario                              | providers, preferencias por usuario e inbox no frontend                    |
| Agenda do vendedor         | parcial                     | tarefas, metas, interacoes, ranking e links WhatsApp                                                  | acoes rapidas reais e E2E por papel                                        |
| Dashboard                  | avancado                    | KPIs e series derivados de pedidos reais em centavos                                                  | exportacao e performance com volume                                        |
| Relatorios                 | concluida                   | agregacao por itens reais, timezone UTC explicito, filtros server-side                                | exportacao completa pela UI                                                |
| Cliente 360                | concluida                   | consome `/360`, `/history` e `/cashback` reais                                                        | —                                                                          |
| AITOPIA                    | removido                    | —                                                                                                     | reintroduzir apenas com politica de dados e guardrails aprovados           |
| Busca/notificacoes globais | parcial                     | leitura de notificacoes por tenant                                                                    | busca global real e estados de leitura por usuario                         |
| Observabilidade            | parcial                     | request ID, logs JSON com redaction, health/ready separados, shutdown gracioso, diagnostico de outbox | error tracking, metricas, alertas e SLOs                                   |
| Deploy/operacao            | parcial                     | CI com gates, imagem com tag do commit, backup/restore ensaiado, runbook da outbox                    | backup offsite, restore drill periodico e ensaio de rollback em staging    |

## 4. Bloqueadores imediatos

Todos os P0 listados na auditoria original foram encerrados com evidencia. A
lista abaixo preserva cada item e registra como foi fechado.

### P0 de seguranca — encerrados

| #   | Achado original                                                   | Encerramento                                                                                                                                              |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reset de senha por gerente permite takeover de membership externa | `POST /team/:userId/reset-password` recusa identidade compartilhada com outro tenant; regressao em `routes.test.ts`                                       |
| 2   | Leituras usam apenas `requireAuth` e mantem acesso apos revogacao | `requireTenantContext` aplicado por prefixo a toda rota tenant-scoped, inclusive leitura e exportacao; teste prova 403 na requisicao seguinte a revogacao |
| 3   | Updates aceitam `tenantId` no corpo                               | Schemas de update removem `tenantId` e o storage ignora a coluna; teste dedicado                                                                          |
| 4   | Relacionamentos cross-tenant nao validados                        | Validacao na rota e triggers `tenant mismatch` no banco para pedidos, itens, cashback, execucoes e destinatarios                                          |

### P0 de integridade do produto — encerrados

| #   | Achado original                                                           | Encerramento                                                                                                                        |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cliente 360, cashback, campanhas e automacoes misturam mock com dado real | Nenhum mock permanece no servidor nem no cliente; `CustomerDetail` consome `/360`, `/history` e `/cashback`                         |
| 2   | `POST /campaigns/:id/send` nao envia                                      | Passa a materializar destinatarios, respeitar opt-out e enfileirar job na mesma transacao; `sent` conta apenas entregas confirmadas |
| 3   | Notificacoes retornam sucesso ficticio e logam conteudo                   | Adapters falham fechados, nunca inventam ID de entrega e nao registram destinatario nem conteudo                                    |
| 4   | Nao existe `order_items`                                                  | Migration 0004 cria itens com snapshot de preco; metricas por produto/categoria vem dos itens reais                                 |
| 5   | Listas exibem apenas a primeira pagina sem avisar                         | Paginacao, busca, filtros e ordenacao server-side com envelope de paginacao                                                         |

### P0 operacional — encerrados

| #   | Achado original                                     | Encerramento                                                                                            |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Nao existe CI                                       | `.github/workflows/ci.yml` roda runtime fixado, format, lint, docs, typecheck, cobertura, build e audit |
| 2   | Render com auto-deploy sem gates                    | CI obrigatoria em PR e main antes do deploy                                                             |
| 3   | Cobertura 8,29% sem thresholds                      | 27,04% com thresholds em 26/21/19/26                                                                    |
| 4   | OpenAPI cobre fracao das rotas                      | 100% das operacoes publicadas, com teste de paridade bidirecional                                       |
| 5   | Docker mantem `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true` | Compose usa `false` por padrao; ciclo de container validado com a flag desligada                        |
| 6   | Rollback depende de imagem local                    | Imagem publicada com tag do commit; rollback documentado por `APP_VERSION`                              |
| 7   | Vulnerabilidade alta de runtime                     | `npm audit --omit=dev --audit-level=high` retorna 0 vulnerabilidades                                    |

### Defeito encontrado durante a validacao desta sessao

`GET /api/<qualquer>` inexistente caia no fallback da SPA e respondia 200 com
HTML. Corrigido para 404 JSON com codigo `ROUTE_NOT_FOUND`, com regressao.

## 5. Arquitetura-alvo incremental

Nao e necessario trocar a stack para concluir o produto. A evolucao recomendada preserva React, Express, Drizzle, SQLite e npm enquanto o volume e a disponibilidade permitirem.

```text
React/TanStack Query
        |
        v
API Express por dominio
  auth | tenants | customers | catalog | orders | loyalty
  campaigns | automations | seller | reports | admin
        |
        +--> middleware unico de contexto tenant e capacidades
        +--> schemas Zod de request/response
        +--> servicos de dominio transacionais
        +--> outbox/jobs idempotentes
        |
        v
Drizzle + SQLite
  migrations incrementais | constraints | ledger | audit log
```

### Fronteiras obrigatorias

- A rota autentica e valida o contrato; nao executa regra de negocio extensa.
- O contexto tenant e derivado no servidor e revalidado em cada operacao tenant-scoped.
- Servicos de dominio aplicam transacoes, invariantes e idempotencia.
- Storage/repositories nunca aceitam alteracao de `tenantId` em update.
- Jobs externos usam outbox, chave idempotente, retry limitado e historico.
- Frontend usa um cliente HTTP tipado e preserva envelopes de paginacao/erro.
- OpenAPI e testes de contrato representam a API realmente publicada.

### Decisoes de arquitetura que exigem ADR

1. Identidade global compartilhada versus identidade separada por tenant.
2. Limite operacional do SQLite e gatilhos objetivos para migrar de banco.
3. Estrategia de jobs: processo interno inicialmente ou fila externa.
4. Provedores de email, SMS e WhatsApp e politica de consentimento.
5. Escopo do AITOPIA, dados que podem sair do sistema e retencao.
6. Representacao monetaria em centavos e estrategia de migracao dos `REAL` atuais.
7. Soft delete, retencao, anonimização e requisitos LGPD.

## 6. Plano por fases e gates

### Fase 0 — Estabilizar baseline e retomabilidade

Objetivo: tornar o snapshot atual reproduzivel antes de ampliar o produto.

Tarefas:

- revisar e separar as alteracoes locais preexistentes em unidades coerentes;
- fixar Node/npm em `package.json` e `.node-version` ou mecanismo equivalente;
- registrar este plano como fonte oficial de status e criar modelo de checkpoint/handoff;
- criar CI basica com `npm ci`, check, testes, coverage e build;
- adicionar lint/formatter usando uma unica configuracao compativel com a stack;
- mover bancos de teste para diretorios temporarios com teardown;
- atualizar indice documental e marcar documentos obsoletos.

Gate F0:

- clone limpo no runtime fixado executa instalacao, check, testes e build;
- CI e obrigatoria em PR/main;
- nenhuma mudanca preexistente e perdida;
- checkpoint registra commit/base, comandos, resultados, riscos e proximo passo.

### Fase 1 — Fechar isolamento tenant e autenticacao

Objetivo: remover todos os bloqueadores de takeover e cross-tenant.

Tarefas:

- redesenhar reset de senha de membros;
- criar middleware unico `tenantContext` que revalida tenant, membership e role;
- aplicar o middleware em toda rota tenant-scoped, inclusive leituras/exportacoes;
- criar schemas de update com allowlist e omissao de campos imutaveis;
- reforcar storage para rejeitar mudanca de tenant;
- validar IDs relacionados dentro do tenant antes de gravar;
- normalizar email e criar unicidade estrutural com migration incremental;
- unificar politica de senha em 12+ caracteres ou politica aprovada;
- envolver cadastro e criacao de equipe em transacoes;
- criar audit log para login, reset, mudanca de role, exportacao e exclusao;
- limitar respostas 500/health e limites de query.

Gate F1:

- testes cross-tenant positivos/negativos passam para SELECT/POST/PUT/DELETE/export;
- membership removida causa 403 na proxima requisicao;
- gerente de tenant A nao altera credencial ou perfil de tenant B;
- `tenantId` enviado pelo cliente nunca altera escopo;
- nenhum relacionamento cross-tenant pode ser persistido;
- relatorio de seguranca P0/P1 esta encerrado ou possui aceite formal.

### Fase 2 — Contratos, banco e modularizacao segura

Objetivo: reduzir divergencia e preparar os modulos de negocio.

Tarefas:

- escolher uma unica estrategia de migrations incrementais;
- alinhar `shared/schema.ts`, bootstrap e arquivos de migration;
- ampliar validacao de drift sem marcar versao que nao foi realmente aplicada;
- criar migrations nao destrutivas, preflight, backup e rollback/contencao;
- dividir `server/routes.ts` e `server/storage.ts` por dominio sem mudar contratos;
- padronizar schemas Zod de create/update/query/response;
- padronizar envelope de erros e paginacao;
- completar OpenAPI para 100% das operacoes publicadas;
- adicionar teste automatico de paridade rota-especificacao;
- migrar valores monetarios para centavos conforme ADR.

Gate F2:

- banco novo e banco da versao anterior convergem para o mesmo schema;
- migration e rollback/contencao sao testados em copia descartavel;
- OpenAPI valida em CI e corresponde as rotas;
- APIs existentes continuam compativeis ou mudancas possuem versao/plano de migracao.

### Fase 3 — Clientes, catalogo, pedidos e estoque

Objetivo: estabelecer a base transacional que alimenta todo o CRM.

Tarefas:

- implementar paginacao, busca, filtros e ordenacao server-side;
- criar `order_items` com snapshot de produto, preco, quantidade e totais;
- gerar identificador de pedido no servidor;
- validar cliente/produto do tenant;
- criar pedido e baixar estoque em uma transacao;
- definir cancelamento, estorno de estoque e idempotencia;
- associar vendedor quando aplicavel;
- revisar importacao: validacao por linha, deduplicacao, dry-run e atomicidade configuravel;
- conectar todos os botoes de filtro/exportacao ou remove-los do escopo.

Gate F3:

- pedido inconsistente nao deixa estoque parcial;
- cancelamento e retry nao duplicam efeitos;
- mais de 50 registros funcionam em listas e seletores;
- metricas por produto/categoria usam itens de pedido reais;
- testes de integracao cobrem concorrencia e tenants distintos.

### Fase 4 — Cliente 360 e cashback confiavel

Objetivo: substituir dados cenograficos por historico e ledger auditaveis.

Tarefas:

- conectar Cliente 360 as APIs reais;
- remover compras, campanhas, churn e cashback mockados;
- criar ledger de cashback em centavos com chave idempotente;
- implementar credito, debito, expiracao, reversao e saldo em transacao;
- ligar eventos de pedido ao cashback;
- criar reconciliacao entre ledger, saldo e pedidos;
- conectar widgets de distribuicao, expiracao e historico;
- definir e testar timezone e arredondamento.

Gate F4:

- cada valor financeiro e derivavel de registros auditaveis;
- retry nao duplica credito/debito;
- saldo nunca cruza tenant e nao fica negativo sem regra explicita;
- Cliente 360 de clientes diferentes exibe dados diferentes e reais;
- reconciliacao automatizada termina sem divergencias no fixture de teste.

### Fase 5 — Notificacoes e campanhas reais

Objetivo: entregar mensagens de modo consentido, rastreavel e resiliente.

Tarefas:

- escolher providers e contratos de adaptador;
- implementar preferencias, consentimento, opt-out e listas de supressao;
- criar outbox/job por destinatario com chave idempotente;
- aplicar timeouts, retry com backoff, rate limit e dead-letter;
- validar webhooks de provider e deduplicar eventos;
- persistir audiencia e status por destinatario;
- implementar revisar, agendar, confirmar e cancelar campanha;
- remover logs de conteudo/PII e adicionar redaction;
- conectar inbox e badge do frontend.

Gate F5:

- nenhuma campanha declara sucesso sem aceite do provider;
- retry nao duplica entrega;
- falha parcial e visivel por destinatario;
- opt-out impede envio;
- webhooks invalidos sao rejeitados;
- testes usam sandbox/fakes, nunca producao.

### Fase 6 — Motor de automacoes

Objetivo: transformar registros visuais em automacoes executaveis.

Tarefas:

- modelar trigger, condicao, acao, versao e estado;
- criar `automation_executions` e passos de execucao;
- definir eventos de dominio suportados;
- implementar scheduler/worker e lock/lease;
- criar idempotencia por evento + automacao + versao;
- implementar retry, dead-letter, pausa e cancelamento;
- expor historico real e metricas;
- limitar templates sugeridos as capacidades realmente implementadas.

Gate F6:

- pausar impede novas execucoes;
- evento duplicado nao gera acao duplicada;
- falhas sao reprocessaveis e auditaveis;
- jobs preservam tenant em payload, lookup, cache e logs;
- historico da UI corresponde ao banco.

### Fase 7 — Frontend, papeis, acessibilidade e responsividade

Objetivo: tornar todos os fluxos completos e verificaveis no navegador.

Tarefas:

- centralizar capacidades por papel para UX, mantendo autorizacao no servidor;
- ocultar/desabilitar acoes manager-only para sellers;
- tratar 401, 403, loading, vazio, erro e retry consistentemente;
- remover todos os botoes sem acao;
- persistir somente configuracoes realmente suportadas;
- corrigir nomes acessiveis, foco, teclado, overlays e alternativas de graficos;
- testar 375, 768, 1280 e 1920 px;
- decidir integracao ou remocao do AITOPIA;
- traduzir 404/Error Boundary e adicionar navegacao segura.

Gate F7:

- E2E passa para seller, manager e super admin;
- axe nao encontra violacoes criticas;
- fluxos principais funcionam por teclado;
- regressao visual cobre breakpoints definidos;
- UI nao apresenta mock como dado real nem acao sem efeito.

### Fase 8 — QA, performance e seguranca continua

Objetivo: criar evidencia proporcional ao risco.

Tarefas:

- organizar piramide de testes por dominio;
- definir thresholds progressivos, com cobertura alta para auth/tenant/ledger/jobs;
- adicionar integracao real com SQLite temporario, sem mockar storage;
- adicionar E2E de happy path e negacao cross-tenant;
- adicionar testes de contrato, migrations, backup/restore e rollback;
- testar carga em listas, relatorios, health e jobs;
- integrar audit de runtime e atualizacao controlada de dependencias;
- corrigir `ip-address`/`body-parser` ou registrar aceite temporario.

Gate F8:

- CI reproduz todos os gates;
- nenhum teste deixa banco/arquivo residual;
- cobertura atende os thresholds aprovados;
- audit nao possui alta/critica sem aceite formal;
- performance atende metas documentadas com massa representativa.

### Fase 9 — Observabilidade, backup e operacao

Objetivo: operar e recuperar o sistema com seguranca.

Tarefas:

- separar liveness leve, readiness e verificacao profunda de integridade;
- padronizar logs JSON com request/build/tenant IDs e redaction;
- adicionar error tracking, metricas, alertas, dashboards e SLOs;
- implementar shutdown gracioso e tratamento de falhas de processo;
- automatizar backup consistente, criptografado, offsite e com retencao;
- definir RPO/RTO e restore drill periodico;
- publicar imagens imutaveis com digest e retencao;
- corrigir bootstrap para recriar o container com flag segura;
- documentar rollback Docker, Render e Railway e ensaiar em staging.

Gate F9:

- alerta de indisponibilidade e erro foi exercitado;
- restore atende RPO/RTO com evidencia;
- rollback de app e contencao de migration foram ensaiados;
- reinicio nao pode bootstrapar banco vazio acidentalmente;
- runbook possui owner e escalacao.

### Fase 10 — Go-live controlado

Objetivo: liberar somente o escopo comprovadamente pronto.

Tarefas:

- congelar escopo e publicar release candidate;
- executar checklist de seguranca, privacidade/LGPD, QA e operacao;
- validar configuracao e volume persistente sem imprimir segredos;
- executar smoke em staging e ensaio de rollback;
- aprovar riscos residuais por owner;
- liberar gradualmente e monitorar;
- criar checkpoint pos-go-live e backlog da proxima versao.

Gate final:

- todos os P0/P1 encerrados;
- CI verde no commit da release;
- backup recente e restore comprovado;
- dashboards/alertas ativos;
- rollback disponivel;
- nenhum modulo fora do escopo e anunciado como funcional.

## 7. Estrategia de testes por risco

| Area            | Unitario                | Integracao                           | E2E/operacional                                |
| --------------- | ----------------------- | ------------------------------------ | ---------------------------------------------- |
| Auth/sessao     | schemas, senha, token   | sessao real, revogacao, CSRF         | login, troca, logout e sessao expirada         |
| Tenant/RBAC     | capacidades             | dois tenants e usuario compartilhado | seller/manager/admin, 403 e revogacao imediata |
| CRUD            | schemas e mapeamento    | banco real e constraints             | criar/editar/excluir por papel                 |
| Pedidos/estoque | totais e estados        | transacao, retry e concorrencia      | pedido completo e cancelamento                 |
| Cashback        | arredondamento e regras | ledger, idempotencia e reconciliacao | credito, resgate, expiracao e reversao         |
| Campanhas/jobs  | audiencia e templates   | outbox, retry e webhook              | sandbox do provider e falha parcial            |
| Automacoes      | condicoes               | lock, retry, duplicidade             | evento ate historico na UI                     |
| Frontend        | hooks/componentes       | cliente HTTP/contratos               | Playwright, axe e breakpoints                  |
| Banco           | schema                  | upgrade/rollback                     | restore de backup e startup                    |
| Deploy          | scripts                 | imagem/container                     | staging, health, rollback e alertas            |

## 8. Politica de rollout e rollback

- Nenhuma migration destrutiva deve ser executada no banco original.
- Toda mudanca de schema usa backup verificado, preflight, copia descartavel e migration incremental.
- Mudancas incompatíveis usam expand/migrate/contract quando necessario.
- Releases usam imagem/artefato imutavel e identificador de build.
- Rollback da aplicacao nao deve depender de imagem local nao versionada.
- Se o rollback de schema nao for seguro, usar contencao e forward-fix documentados.
- Providers externos iniciam em sandbox e rollout limitado por tenant.
- Deploy e migracao remotos exigem autorizacao explicita.

## 9. Documentacao a atualizar durante as fases

- `README.md`: somente capacidades realmente operacionais.
- `docs/openapi.yaml`, `docs/API_README.md`, `docs/API_QUICK_REFERENCE.md`: paridade total.
- `docs/DATABASE.md` e `migrations/README.md`: estrategia unica e rollback.
- `SECURITY.md` e `CSRF_SECURITY.md`: comportamento real.
- `DEPLOY.md`, `BACKUP_RESTORE.md`, `RUNBOOK_PRODUCAO.md`, `GO_LIVE_CHECKLIST.md`: procedimentos ensaiados.
- `replit.md` e `DOCS_INDEX.md`: atualizar ou arquivar como obsoletos.
- ADRs: identidade/tenant, jobs, dinheiro, SQLite, providers, IA e retencao.

## 10. Checkpoint de retomada

**Checkpoint:** 2026-08-29, sessao de implementacao das Fases 0 a 9
**Branch:** `feat/e2e-and-observability`, a partir do release `b921fb3` em `main`
**Runtime:** Node 20.19.0, npm 10.8.2 (o shell padrao da maquina e Node 24; use
`fnm use 20.19.0` antes de qualquer gate, senao `better-sqlite3` falha por ABI)

### Situacao por fase

| Fase                          | Estado                       | Observacao                                                                                                                                                                  |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 baseline                   | concluida                    | runtime fixado, CI com gate de E2E, lint/format, baseline commitada                                                                                                         |
| F1 tenant e autenticacao      | concluida                    | P0 de seguranca fechados, com regressao de unidade e de navegador                                                                                                           |
| F2 contratos e banco          | concluida                    | OpenAPI 100% com gate de paridade; `routes.ts` dividido em 25 modulos e contrato de storage extraido. **A classe `DatabaseStorage` continua unica, por decisao registrada** |
| F3 pedidos e estoque          | concluida                    | itens, estoque transacional, cancelamento idempotente, listagem server-side                                                                                                 |
| F4 cliente 360 e cashback     | concluida                    | ledger em centavos com reconciliacao; UI sem mock                                                                                                                           |
| F5 notificacoes e campanhas   | concluida na infraestrutura  | outbox, destinatarios, consentimento e adapters fail-closed. **Providers reais, webhooks e agendamento futuro pendentes**                                                   |
| F6 automacoes                 | concluida                    | definicao versionada, execucoes idempotentes, historico real                                                                                                                |
| F7 frontend e acessibilidade  | concluida                    | 40 testes de navegador, axe sem violacao critica ou seria em 10 telas, breakpoints 375/768/1280/1920, gate de console sem erros                                             |
| F8 QA e performance           | concluida                    | 210 testes, thresholds ativos, teste de carga com orcamentos versionados                                                                                                    |
| F9 observabilidade e operacao | concluida                    | identidade de build em log/health/metricas, endpoint Prometheus, SLOs, regras de alerta e retencao de backup. **Sem error tracking integrado, por decisao registrada**      |
| F10 go-live                   | executada ate o limite local | checklist preenchido com evidencia; itens de ambiente final permanecem com o operador e o deploy segue manual por decisao (`autoDeploy: false`)                             |

### Defeitos reais encontrados pela Fase 7 e corrigidos

1. Os tokens `--spacing-xs..3xl` sombreavam a escala de container do Tailwind v4,
   transformando todo `max-w-xs..xl` da aplicacao em caixas de 8 a 32 px.
2. `Layout` aplicava `lg:ml-64` enquanto o `Sidebar` virava `lg:static`: a linha
   flex estourava e o menu inteiro ficava invisivel no desktop, com 8 px de
   largura.
3. A tela de Relatorios enviava instante ISO completo e recebia 400 do servidor,
   entao nunca carregava dados.
4. Acessibilidade: contraste insuficiente em badges, KPIs, titulos de secao e
   texto muted; `<span class="contents">` quebrando a semantica do breadcrumb;
   comboboxes e botao de icone sem nome acessivel; barra de progresso sem
   rotulo; graficos sem alternativa textual.
5. Rota `/api` inexistente respondia 200 com o HTML da SPA.
6. O passo de verificacao de runtime da propria CI estava quebrado.

Cada um tem teste de regressao.

### Nao concluido, com motivo

- **Deploy remoto**: nao executado. `render.yaml` mantem `autoDeploy: false` por
  decisao explicita e as credenciais de producao sao `sync: false`, isto e,
  vivem apenas no painel da plataforma.
- **Divisao de `DatabaseStorage` em repositorios**: os metodos compartilham
  helpers privados e escopos de transacao via `this`, e o codigo de maior risco
  do sistema vive ali. E mudanca arquitetural, nao movimentacao de arquivo.
- **Providers de mensagem, webhooks e atribuicao de campanha**: dependem de
  decisao de produto sobre fornecedor, consentimento e regra de atribuicao.
- **Error tracking integrado**: mecanismo oficial hoje e log estruturado mais
  alerta de taxa de erro.
- **Backup offsite e ensaio periodico de restauracao**: o script produz copia
  verificada com retencao; enviar para fora do volume e agendar o ensaio sao
  passos do operador.

### Proximo passo seguro

1. Abrir PR desta branch, confirmar CI verde (inclui o job de E2E) e mergear.
2. Publicar manualmente no Render a partir do commit da release e executar os
   itens do checklist marcados como **operador**.
3. Apos o primeiro boot, voltar `ALLOW_EMPTY_DATABASE_BOOTSTRAP` para `false` e
   agendar `npm run db:backup` com copia offsite.
4. Decidir providers de mensagem antes de habilitar qualquer canal: enquanto
   `EMAIL_PROVIDER`, `SMS_PROVIDER` e `WHATSAPP_PROVIDER` estiverem vazios, o
   sistema registra `not_configured` e nao envia nada, que e o comportamento
   correto.

### Bloqueios que exigem decisao de produto/arquitetura

- usuarios podem pertencer a varios tenants com a mesma identidade?
- cadastro publico e criacao automatica de tenant devem continuar habilitados?
- quais providers de mensagem entram no MVP e com qual texto de consentimento?
- quais RPO/RTO, volume, concorrencia, retencao e requisitos LGPD se aplicam?
- qual regra de atribuicao libera abertura, conversao e receita de campanha?

Nenhuma dessas decisoes bloqueia o que ja esta implementado.
