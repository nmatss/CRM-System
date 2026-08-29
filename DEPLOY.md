# Deploy

## Decisao De Banco

O deploy atual usa SQLite em volume persistente. Nao habilite PostgreSQL sem plano de migracao aprovado.
Para go-live com SQLite, opere uma unica instancia da aplicacao. Multiplas replicas exigem banco externo e store compartilhado para rate limit/sessao.

## Variaveis Obrigatorias

Produção falha ao iniciar se estas variaveis estiverem ausentes ou forem placeholders:

```bash
NODE_ENV=production
PORT=6000
DATABASE_PATH=/app/data/zippcrm.db
SESSION_DATABASE_PATH=/app/data/sessions.db
TRUST_PROXY=1 # somente atras de proxy confiavel/PaaS
SESSION_SECRET=<minimo 32 caracteres>
ADMIN_EMAIL=<email valido>
ADMIN_PASSWORD=<minimo 12 caracteres>
ALLOW_EMPTY_DATABASE_BOOTSTRAP=false
```

Nunca comite `.env` real.

## Bootstrap SQLite

Em producao, o app recusa criar um banco SQLite novo sem autorizacao explicita. No primeiro boot controlado de um volume persistente vazio, defina temporariamente:

```bash
ALLOW_EMPTY_DATABASE_BOOTSTRAP=true
```

Depois de validar `/api/health`, login super admin e existencia do arquivo em `/app/data/zippcrm.db`, volte para `ALLOW_EMPTY_DATABASE_BOOTSTRAP=false`.

## Docker

```bash
export SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="<senha-forte>"
export ALLOW_EMPTY_DATABASE_BOOTSTRAP=true
export APP_VERSION="$(git rev-parse --short HEAD)"
docker compose up --build -d
docker compose logs -f app
curl -f http://localhost:6000/api/health
export ALLOW_EMPTY_DATABASE_BOOTSTRAP=false
```

Rollback:

```bash
export APP_VERSION=<versao-anterior>
docker compose up -d --no-build
```

Se houve migracao de banco, restaure o backup antes de subir novamente.

## Render

1. Criar blueprint com `render.yaml`.
2. Confirmar disk persistente em `/app/data`. O plano precisa suportar disk persistente; `render.yaml` usa `plan: starter`.
3. Definir `ADMIN_EMAIL` e `ADMIN_PASSWORD` manualmente no dashboard.
4. Usar `SESSION_SECRET` gerado pelo Render ou valor seguro proprio.
5. Manter `TRUST_PROXY=1`, pois Render entrega trafego atras de proxy gerenciado.
6. No primeiro deploy com disk vazio, setar `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true`.
7. Validar `/api/health` apos deploy.
8. Voltar `ALLOW_EMPTY_DATABASE_BOOTSTRAP=false`.

## Railway

1. Conectar repositorio.
2. Criar volume e montar em `/app/data`.
3. Configurar as variaveis obrigatorias no dashboard.
4. Configurar `TRUST_PROXY=1`, pois Railway entrega trafego atras de proxy gerenciado.
5. Confirmar `RAILWAY_VOLUME_MOUNT_PATH=/app/data`; o start falha se o volume nao estiver montado nesse caminho.
6. No primeiro deploy com volume vazio, setar `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true`.
7. Deploy usa `railway.toml`.
8. Validar `/api/health`.
9. Voltar `ALLOW_EMPTY_DATABASE_BOOTSTRAP=false`.

## Backup Antes Do Deploy

```bash
npm run db:backup
```

Em Docker:

```bash
docker compose exec app npm run db:backup
```

Registre caminho, tamanho e SHA-256 retornados pelo comando.

## Smoke Test Minimo

1. `GET /api/health` retorna `healthy`.
2. Login super admin funciona.
3. Criar tenant.
4. Criar usuario manager.
5. Login manager.
6. Criar cliente, produto e pedido.
7. Validar dashboard e relatorios.
8. Validar que outro tenant nao acessa dados do primeiro.
