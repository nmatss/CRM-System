# Plano mestre de conclusao do CRM-System

**Status:** auditoria concluida; implementacao ainda nao iniciada

**Checkpoint:** 2026-08-29

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

## 3. Estado do produto por modulo

| Modulo                     | Estado atual                | O que existe                                                                      | O que falta para conclusao                                                                                          |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Landing e captacao         | parcial                     | landing, contato e demo persistidos                                               | antispam, consentimento/privacidade, workflow de lead, links legais reais e alegacoes de marketing verificadas      |
| Autenticacao               | avancado, com bloqueadores  | login CPF/email, sessao persistente, CSRF, rate limit, troca obrigatoria de senha | corrigir takeover por reset, politica unica de senha, email unico/normalizado, testes E2E e auditoria de eventos    |
| Multi-tenancy              | parcial critico             | memberships N:N e filtros `tenantId` na maior parte do storage                    | contexto tenant revalidado por request, bloquear mass assignment, validar FKs cross-tenant e testar revogacao       |
| Super Admin                | parcial                     | CRUD de tenants, usuarios, memberships, contatos e demos                          | audit log, operacoes transacionais, validacao forte, soft-delete/retencao decididos e E2E de permissoes             |
| Equipe/configuracoes       | parcial                     | settings da loja e gestao de equipe                                               | separar perfil global/tenant, corrigir reset de senha, persistir perfil/preferencias e remover `window.prompt`      |
| Clientes                   | parcial                     | CRUD, import/export e busca local                                                 | paginacao/busca server-side, 360 real, deduplicacao, validacoes e testes de tenant                                  |
| Produtos                   | parcial                     | CRUD e import/export                                                              | paginacao, filtros/ordenacao, permissoes na UI, itens de pedido, estoque transacional e metricas reais              |
| Pedidos                    | parcial                     | CRUD basico                                                                       | `order_items`, ID server-side, transacao de estoque, vendedor, cashback, cancelamento/reversao e exportacao pela UI |
| Cashback                   | parcial critico             | regras e consultas de transacoes                                                  | ledger em centavos, credito/debito idempotentes, atomicidade, expiracao, resgate, reconciliacao e UI sem mocks      |
| Campanhas                  | prototipo funcional de CRUD | CRUD, audiencia em memoria e templates                                            | consentimento, provedor real, agendamento, job idempotente, retry, status por destinatario, tracking e UI de envio  |
| Automacoes                 | prototipo                   | CRUD/toggle e sugestoes                                                           | modelo trigger-condicao-acao, scheduler/worker, executions, retry, dead-letter, historico real e versionamento      |
| Notificacoes               | stub                        | tabela, storage e servico que retorna sucesso simulado                            | providers, outbox/fila, estados reais, redaction, preferencias e inbox no frontend                                  |
| Agenda do vendedor         | parcial                     | tarefas, metas, interacoes, ranking e links WhatsApp                              | validar relacionamentos tenant, acoes rapidas reais, calendario/email aprovados e E2E por papel                     |
| Dashboard                  | parcial                     | KPIs e graficos reais em parte                                                    | remover metricas sem base, corrigir series temporais, exportacao e performance com volume                           |
| Relatorios                 | parcial                     | agregacoes e exportacao CSV parcial                                               | modelo de itens, calculos corretos, timezone, filtros server-side, cashback real e testes de reconciliacao          |
| Cliente 360                | mock apresentado como real  | componente visual completo                                                        | consumir `/360`, `/history` e `/cashback`; remover constantes e testar clientes distintos                           |
| AITOPIA                    | stub visual                 | drawer responsivo                                                                 | integrar API com politica de dados e guardrails ou retirar/rotular como demonstracao                                |
| Busca/notificacoes globais | ausente/parcial             | campos e popovers visuais                                                         | busca real, autorizacao, paginacao, notificacoes por usuario e estados de leitura                                   |
| Observabilidade            | inicial                     | request ID, logger com redaction e healthcheck                                    | logs HTTP correlacionados, error tracking, metricas, alertas, SLOs e shutdown gracioso                              |
| Deploy/operacao            | parcial                     | Docker/PaaS, runbooks e backup manual                                             | CI/CD com gates, rollback imutavel, flag de bootstrap segura, backup offsite e restore drill periodico              |

## 4. Bloqueadores imediatos

### P0 de seguranca

1. Reset de senha por gerente altera uma identidade global compartilhada e permite takeover de memberships externas.
2. Rotas de leitura usam apenas `requireAuth`; membership removida ou tenant inativo pode conservar acesso enquanto a sessao estiver valida.
3. Updates de clientes, produtos, pedidos e automacoes aceitam `tenantId` no corpo e podem mover registros entre empresas.
4. Relacionamentos como pedido-cliente, tarefa-cliente/vendedor e interacao-cliente/tarefa nao garantem que ambos os lados pertencam ao mesmo tenant.

Detalhes e evidencias estao em `security_best_practices_report.md`.

### P0 de integridade do produto

1. Cliente 360, cashback, campanhas e automacoes misturam mocks com dados reais sem aviso.
2. `POST /campaigns/:id/send` nao envia mensagens; apenas altera status e contador.
3. notificacoes retornam sucesso ficticio e podem registrar conteudo de mensagem em console.
4. nao existe `order_items`; metricas de produto/categoria nao representam vendas reais.
5. clientes, produtos e pedidos exibem somente a primeira pagina de ate 50 itens sem informar o usuario.

### P0 operacional

1. nao existe CI em `.github/workflows`;
2. Render possui auto-deploy sem executar testes ou audit;
3. cobertura global e 8,29% e nao ha thresholds;
4. OpenAPI cobre apenas uma fracao das operacoes reais;
5. o procedimento Docker mantem `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true` no container ja criado;
6. rollback depende de imagem local anterior, sem artefato imutavel ou ensaio;
7. ha uma vulnerabilidade alta de runtime ainda nao triada/corrigida.

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

### Concluido nesta sessao

- instrucoes, arquitetura, docs, worktree e stack inspecionados;
- frontend, backend/dados e QA/DevOps auditados em trilhas independentes;
- inventario de modulos e rotas consolidado;
- riscos de seguranca classificados;
- typecheck, testes Node 20, cobertura, build, smoke e configuracao Docker validados;
- audit de dependencias executado;
- plano mestre e relatorio de seguranca criados.

### Nao concluido

- nenhuma correcao de codigo foi implementada;
- nenhuma migration, deploy ou operacao remota foi executada;
- nenhum E2E/browser, Lighthouse ou axe foi executado;
- riscos criticos/altos continuam abertos;
- o worktree preexistente continua sem uma baseline commitada nesta sessao.

### Proximo passo seguro

Iniciar a Fase 0 com um checkpoint do worktree e, em seguida, executar a Fase 1 nesta ordem:

1. criar testes que reproduzam reset cross-tenant, membership revogada e mass assignment;
2. corrigir um achado por vez;
3. repetir check, testes, cobertura, build e smoke a cada ciclo;
4. somente depois iniciar `order_items`, cashback, campanhas ou automacoes.

### Bloqueios que exigem decisao de produto/arquitetura

- usuarios podem pertencer a varios tenants com a mesma identidade?
- cadastro publico e criacao automatica de tenant devem continuar habilitados?
- quais canais de mensagem e providers fazem parte do MVP?
- AITOPIA entra no MVP ou deve ser removido/rotulado como demonstracao?
- quais RPO/RTO, volume, concorrencia, retencao e requisitos LGPD se aplicam?

Essas decisoes nao impedem a correcao dos P0 de seguranca.
