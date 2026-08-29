# Go-Live Checklist

**Execucao registrada em:** 2026-08-29, no runtime fixado (Node 20.19.0 / npm 10.8.2).

Legenda: `[x]` verificado com evidencia nesta maquina ou na CI · `[ ]` depende do
ambiente final e continua com o operador.

## Bloqueantes

- [x] `npm ci` executa sem erro — a CI instala do zero em cada push.
- [x] `npm run check` passa.
- [x] `npm run lint` passa sem warnings (`--max-warnings=0`).
- [x] `npm run format:check` passa.
- [x] `npm run build` passa.
- [x] `npm test -- --run` passa: 34 arquivos, 210 testes.
- [x] `npm run test:coverage -- --run` respeita os thresholds (27/22/20/27).
- [x] `npm audit --omit=dev --audit-level=high` sem vulnerabilidades.
- [ ] `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados em producao — **operador**.
- [ ] `TRUST_PROXY=1` somente atras de proxy/PaaS confiavel; vazio em Docker exposto — **operador**.
- [ ] Volume persistente configurado em `/app/data` — **operador**.
- [x] Primeiro boot de volume vazio exige `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true`:
      verificado que o processo recusa iniciar sem a flag e nao abre porta.
- [x] Reinicio com `ALLOW_EMPTY_DATABASE_BOOTSTRAP=false` sobre volume existente
      funciona: ciclo de container validado (boot com flag, stop gracioso,
      restart sem flag).
- [x] Backup inicial executado e restore testado: integridade `ok`, zero FKs
      invalidas e aplicacao sobe a partir da copia. Manifesto com SHA-256.
- [x] `/api/health` retorna healthy, com versao, commit e instante do build.
- [x] `/api/ready` retorna ready com `database: connected`.
- [x] Diagnostico profundo disponivel em rota restrita a super admin
      (`/api/v1/admin/diagnostics/database` e `/admin/diagnostics/outbox`).
- [x] Login super admin validado (E2E).
- [x] Criacao de tenant validada (fixture E2E via storage e painel admin).
- [x] Criacao de usuario manager validada (fixture E2E).
- [x] Login manager validado (E2E).
- [x] CRUD de clientes/produtos/pedidos validado (E2E + integracao).
- [x] CSRF validado em mutacao autenticada: requisicao sem token retorna 403 (E2E).
- [x] Isolamento por tenant validado: leitura, mass assignment, FK cross-tenant e
      revogacao de membership em sessao viva (E2E + integracao).
- [x] Logs revisados sem secrets: o logger redige `password`, `token`, `secret`,
      `session`, `authorization`, `cookie` e `csrf`, e omite stack em producao.
- [ ] Deploy confirmado como single-instance — **operador**. Com multiplas
      replicas, o rate limit e o worker da outbox precisam ser revistos (ADR 0001).

## Validacoes Funcionais

- [x] Dashboard carrega (E2E + gate de console sem erros).
- [x] Relatorios carregam — **defeito corrigido nesta rodada**: a tela enviava
      instante ISO completo e o servidor respondia 400; agora envia o dia de
      calendario que o usuario escolheu.
- [x] Cashback rules CRUD validado (integracao).
- [x] Campanhas CRUD validado (E2E), incluindo agendamento de envio.
- [x] Automacoes CRUD/toggle validado (E2E).
- [x] Agenda do vendedor carrega tarefas, metas e ranking (E2E + gate de console).
- [x] Importacao de clientes validada (integracao).
- [x] Importacao de produtos validada (integracao).
- [x] Exportacao de clientes/produtos/pedidos validada, com neutralizacao de
      formulas de planilha (integracao).
- [x] Reset de senha manager validado: recusa identidade compartilhada com outro
      tenant (integracao).
- [x] Smoke E2E desktop e mobile: 40 testes, sem overflow horizontal em
      375/768/1280/1920 px e sem erro de console nas dez telas principais.

## Riscos A Aceitar Ou Resolver Antes Do Go-Live

- [x] Dependencias avaliadas: `npm audit --omit=dev --audit-level=high` retorna
      zero vulnerabilidades.
- [ ] SQLite aceito para o volume inicial esperado — **decisao de produto**.
      Medicoes com 4.000 clientes e 4.000 pedidos estao em `docs/OBSERVABILITY.md`;
      os gatilhos de migracao estao no ADR 0001.
- [x] Backlog de performance criado: teste de carga com orcamentos versionado em
      `server/__tests__/performance.test.ts`.
- [x] Integracoes externas nao implementadas estao documentadas como ausentes:
      sem provedor configurado o canal falha fechado e o README declara o que
      ainda nao esta operacional.
- [x] Campanhas/automacoes/notificacoes nao retornam sucesso ficticio: cada
      destinatario tem status proprio e `not_configured` e um estado explicito.
- [x] Politica de backup e retencao definida: `BACKUP_KEEP` (padrao 14), com
      manifesto por copia. Copia offsite continua sendo passo do operador.
- [x] Plano de rollback documentado e ensaiado localmente (imagem anterior por
      `APP_VERSION`; migration 0008 e aditiva e o binario anterior le o banco
      migrado).
- [x] Versao de imagem/tag de rollback definida: a imagem e publicada com a tag
      do commit e `/api/health` devolve o mesmo commit.
- [x] Auto-deploy permanece desativado (`render.yaml` com `autoDeploy: false`)
      ate protecao de branch e aprovacao manual serem confirmadas.

## Pendencias declaradas para a proxima versao

- Providers reais de email/SMS/WhatsApp, webhooks assinados e supressao global.
- Metricas de atribuicao de campanha (abertura, conversao, receita).
- Error tracking integrado; hoje o mecanismo oficial e log estruturado mais
  alerta de taxa de erro (`docs/OBSERVABILITY.md`).
- Divisao da classe `DatabaseStorage` em repositorios por dominio.
- Backup offsite automatizado e ensaio de restauracao periodico agendado.
