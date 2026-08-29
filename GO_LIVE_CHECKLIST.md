# Go-Live Checklist

## Bloqueantes

- [ ] `npm ci` executa sem erro.
- [ ] `npm run check` passa.
- [ ] `npm run lint` passa sem warnings.
- [ ] `npm run format:check` passa.
- [ ] `npm run build` passa.
- [ ] `npm test -- --run` passa.
- [ ] `npm run test:coverage -- --run` respeita os thresholds aprovados.
- [ ] `npm audit --omit=dev --audit-level=high` sem vulnerabilidades altas/criticas de runtime ou com aceite formal de risco.
- [ ] `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados em producao.
- [ ] `TRUST_PROXY=1` configurado somente atras de proxy/PaaS confiavel; vazio em Docker exposto diretamente.
- [ ] Volume persistente configurado em `/app/data`.
- [ ] Primeiro boot de volume vazio autorizado apenas com `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true`.
- [ ] `ALLOW_EMPTY_DATABASE_BOOTSTRAP=false` apos bootstrap inicial.
- [ ] Backup inicial executado e restore testado.
- [ ] `/api/health` retorna healthy no ambiente final.
- [ ] `/api/ready` retorna ready no ambiente final.
- [ ] Diagnostico profundo de banco passa via rota restrita a superadmin ou procedimento operacional.
- [ ] Login super admin validado.
- [ ] Criacao de tenant validada.
- [ ] Criacao de usuario manager validada.
- [ ] Login manager validado.
- [ ] CRUD de clientes/produtos/pedidos validado.
- [ ] CSRF validado em mutacao autenticada.
- [ ] Isolamento por tenant validado.
- [ ] Logs revisados sem secrets ou senhas.
- [ ] Deploy confirmado como single-instance; se houver multiplas replicas, configurar store compartilhado para rate limit antes do go-live.

## Validacoes Funcionais

- [ ] Dashboard carrega.
- [ ] Relatorios carregam.
- [ ] Cashback rules CRUD validado.
- [ ] Campanhas CRUD validado.
- [ ] Automacoes CRUD/toggle validado.
- [ ] Agenda do vendedor carrega tarefas, metas e ranking.
- [ ] Importacao de clientes validada.
- [ ] Importacao de produtos validada.
- [ ] Exportacao de clientes/produtos/pedidos validada.
- [ ] Reset de senha admin/manager validado com procedimento seguro.
- [ ] Smoke E2E desktop e mobile validado, sem overflow horizontal nem erros de console relevantes.

## Riscos A Aceitar Ou Resolver Antes Do Go-Live

- [ ] Dependencias com vulnerabilidades remanescentes avaliadas.
- [ ] SQLite aceito para volume inicial esperado.
- [ ] Backlog de performance criado para agregacoes em memoria e N+1.
- [ ] Integracoes externas nao implementadas removidas do escopo operacional ou documentadas como stubs.
- [ ] Campanhas/automacoes/notificacoes nao retornam sucesso ficticio; provider ausente falha fechado.
- [ ] Politica de backup e retencao aprovada.
- [ ] Plano de rollback aprovado.
- [ ] Versao de imagem/tag de rollback definida (`APP_VERSION` em Docker Compose).
- [ ] Auto-deploy permanece desativado ate CI obrigatoria, protecao de branch e aprovacao manual serem confirmadas.
