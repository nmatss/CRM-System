# CRM-System Database

## Decisao Atual

O banco oficial atual do CRM-System e SQLite, acessado por `better-sqlite3` e Drizzle ORM.

- Configuracao runtime: `server/db.ts`
- Schema fonte: `shared/schema.ts`
- Configuracao Drizzle: `drizzle.config.ts`
- Caminho padrao local: `./data/zippcrm.db`
- Caminho padrao container/producao: `/app/data/zippcrm.db`
- Sessoes server-side podem usar arquivo separado via `SESSION_DATABASE_PATH`, recomendado em producao: `/app/data/sessions.db`

PostgreSQL nao e dependencia operacional atual. Qualquer migracao para PostgreSQL deve ser tratada como projeto separado, com plano de migracao, validacao de dados, janela de rollback e aceite tecnico.

## Persistencia

SQLite grava em arquivo unico. Em producao, o diretorio de dados precisa estar em volume persistente:

- Docker: volume montado em `/app/data`
- Render: disk montado em `/app/data`
- Railway: volume manual montado em `/app/data`

O runtime habilita:

- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL`
- Criacao idempotente das tabelas e indices principais no startup para volumes SQLite vazios
- Registro de versao em `schema_migrations`
- Validacao de tabelas, colunas e indices criticos no startup

Em producao, a criacao de um banco vazio e bloqueada por padrao. Para o primeiro boot controlado de um volume persistente vazio, use `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true`, valide o ambiente e volte para `false`.

## Modelo Logico

```text
tenants
├── tenant_users ── users
├── customers
│   ├── orders
│   ├── cashback_transactions
│   └── customer_interactions
├── products
├── orders
│   └── order_items ── products
├── cashback_rules
│   └── cashback_transactions
├── cashback_accounts
│   └── cashback_credit_lots
│       └── cashback_debit_allocations
├── campaigns
├── automations
├── seller_tasks
├── seller_goals
└── notifications

global
├── audit_events (tenant/actor IDs preservados como snapshots)
├── contact_requests
├── demo_requests
├── password_resets
├── schema_migrations
└── sessions (em `SESSION_DATABASE_PATH` quando configurado)
```

## Tabelas Principais

| Tabela                       | Escopo        | Finalidade                                                |
| ---------------------------- | ------------- | --------------------------------------------------------- |
| `tenants`                    | Global        | Lojas/empresas do ambiente multi-tenant                   |
| `users`                      | Global        | Usuarios autenticaveis e super admins                     |
| `tenant_users`               | Global        | Vinculo N:N entre usuarios e tenants com role             |
| `customers`                  | Tenant        | Cadastro e segmentacao de clientes                        |
| `products`                   | Tenant        | Catalogo e estoque                                        |
| `orders`                     | Tenant        | Pedidos e historico comercial                             |
| `order_items`                | Tenant        | Itens, quantidade e snapshot monetario imutavel do pedido |
| `cashback_rules`             | Tenant        | Regras de cashback                                        |
| `cashback_transactions`      | Tenant        | Creditos/debitos e saldo de cashback                      |
| `cashback_accounts`          | Tenant        | Saldo atual reconciliavel em centavos por cliente         |
| `cashback_credit_lots`       | Tenant        | Lotes de credito, saldo remanescente e expiracao          |
| `cashback_debit_allocations` | Tenant        | Alocacao FIFO dos debitos aos lotes                       |
| `campaigns`                  | Tenant        | Campanhas comerciais                                      |
| `automations`                | Tenant        | Automacoes configuradas                                   |
| `seller_tasks`               | Tenant        | Agenda e tarefas do vendedor                              |
| `seller_goals`               | Tenant        | Metas por vendedor                                        |
| `customer_interactions`      | Tenant        | Historico de interacoes                                   |
| `notifications`              | Tenant        | Notificacoes internas                                     |
| `audit_events`               | Global/Tenant | Eventos de seguranca append-only com metadata allowlisted |
| `contact_requests`           | Global        | Formulario publico de contato                             |
| `demo_requests`              | Global        | Solicitacoes publicas de demo                             |
| `schema_migrations`          | Global        | Registro de versao do schema SQLite bootstrap             |
| `sessions`                   | Global        | Sessoes server-side                                       |

## Indices E Constraints

Os indices e constraints ficam definidos em `shared/schema.ts`. Os principais padroes sao:

- Indices por `tenant_id` em tabelas tenant-scoped
- Indices por status, datas e chaves de relacionamento
- `uniqueIndex` em `tenant_users(tenant_id, user_id)`
- `uniqueIndex` em `orders(tenant_id, order_id)`
- `uniqueIndex` em `order_items(tenant_id, order_id, product_id)`
- Checks de quantidade positiva e totais exatos em centavos em `order_items`
- Triggers impedem referencias de pedido/produto de outro tenant em `order_items`
- Indice composto em `orders(tenant_id, customer_id, order_date)`
- Indice composto em `cashback_transactions(tenant_id, customer_id, created_at)`
- Indice composto em `cashback_transactions(tenant_id, expires_at)`
- Checks de valores nao negativos em produtos, pedidos, clientes e cashback
- Produtos mantêm `price_cents` como preço autoritativo; `price` é projeção decimal de compatibilidade
- Itens de pedido preservam `category_snapshot` imutável para relatórios históricos
- Checks de percentual entre 0 e 100 em campanhas

## Migrations

Scripts disponiveis:

```bash
npm run db:push
npm run db:generate
npm run db:studio
npm run db:backup
npm run db:migrate:constraints
```

O startup cria o schema base quando o arquivo SQLite esta vazio. Ainda assim, use `npm run db:push` em desenvolvimento e antes de validar mudancas estruturais de schema.

`npm run db:migrate:constraints` e um script legado reconstrutivo. Ele falha por padrao e so deve ser executado com backup validado:

```bash
ALLOW_DESTRUCTIVE_CONSTRAINT_MIGRATION=true BACKUP_CONFIRMED=true npm run db:migrate:constraints
```

Antes de qualquer migracao em ambiente com dados reais:

1. Parar writes ou colocar o sistema em manutencao.
2. Fazer backup via `npm run db:backup` e registrar SHA-256/tamanho.
3. Testar restore em outro diretorio.
4. Rodar migracao em staging ou copia local.
5. Validar healthcheck e fluxos criticos.
6. So entao executar em producao.

`0004_order_items.sql` e aditiva. Novos pedidos com `lineItems` geram o identificador publico no servidor,
capturam o preco em centavos e baixam estoque na mesma transacao. Cancelamento e idempotente e restaura o
estoque uma unica vez. Pedidos legados sem itens continuam legiveis, mas novas criacoes exigem `lineItems`.

`0005_cashback_ledger.sql` preserva as colunas decimais legadas, mas novas operacoes usam centavos inteiros,
idempotencia, lotes FIFO e transacoes SQLite. Reversao de credito ja consumido e recusada; reversao de debito
restaura exatamente suas alocacoes. Expiracao consome somente o remanescente e pode ser repetida com seguranca.
A interpretacao automatica das regras textuais de cashback em pedidos ainda nao foi implementada; creditos ligados
a pedido/regra precisam ser comandados explicitamente ate existir uma especificacao de calculo aprovada.

`0006_normalized_email_audit_events.sql` cria unicidade estrutural de identidade por
`LOWER(TRIM(users.email))`. O preflight falha sem alterar dados quando encontra colisões legadas; não há merge
automático. A mesma migration cria `audit_events`, append-only por triggers. `tenant_id` e `actor_user_id` são
snapshots deliberadamente sem FK para preservar a evidência após exclusões. Metadados aceitam apenas chaves
primitivas allowlisted por ação; email, CPF, IP bruto, senhas, tokens e payloads arbitrários não são persistidos.
Mutações privilegiadas suportadas gravam domínio e auditoria na mesma transação SQLite. Login só registra sucesso
depois da sessão persistida; falha de auditoria invalida a sessão e fecha a autenticação.

`0007_integer_money_reports.sql` faz o cutover aditivo de catálogo e relatórios para dinheiro inteiro.
O upgrade usa `ROUND(valor * 100)` para preencher `products.price_cents` e `customers.ltv_cents`, preserva
as colunas decimais e sincroniza escritores legados por triggers. `order_items.category_snapshot` recebe a
categoria conhecida no upgrade e não pode ser alterado depois. Novos pedidos capturam preço e categoria na
transação de criação. O LTV persistido é apenas projeção de compatibilidade: relatórios, Customer 360 e KPIs
derivam gasto de `orders.total_cents`, sempre excluindo `Cancelado`. Relatórios aceitam intervalo completo em
`YYYY-MM-DD` e timezone `UTC`; categorias de pedidos legados sem itens não são inventadas. Métricas de campanha
dependentes de atribuição retornam zero com `metricsAvailable=false` até existir uma fonte de eventos aprovada.

## Gargalos Conhecidos

- SQLite e adequado para go-live inicial, mas limita escrita concorrente e escala horizontal.
- Alguns dashboards e relatorios agregam dados em memoria.
- Distribuicao de cashback ainda pode gerar N+1 queries em volumes altos.
- Paginação por offset pode degradar com bases grandes.

Esses pontos devem ir para backlog tecnico antes de aumento relevante de volume.
