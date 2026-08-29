# Backup E Restore

## Escopo

O banco atual e SQLite. O arquivo principal fica em `DATABASE_PATH`; em producao, normalmente `/app/data/zippcrm.db`.

Sessoes server-side podem ficar em `SESSION_DATABASE_PATH`, normalmente `/app/data/sessions.db`. Esse arquivo nao precisa entrar no backup de dados de negocio; sessoes podem ser recriadas por novo login.

Com WAL habilitado, podem existir tambem:

- `zippcrm.db-wal`
- `zippcrm.db-shm`

## Backup Online Recomendado

Use o utilitario do repositorio, que faz checkpoint WAL e usa a API de backup do SQLite:

```bash
npm run db:backup
```

Docker:

```bash
docker compose exec app npm run db:backup
```

Por padrao, o backup e gravado em `backups/` ao lado do arquivo configurado em `DATABASE_PATH`. Para outro destino:

```bash
BACKUP_DIR=/caminho/seguro npm run db:backup
```

O comando imprime caminho, tamanho, SHA-256, `integrity_check` e quantidade de problemas em `foreign_key_check`. Registre esses dados no ticket/janela de mudanca.

## Alternativa Com SQLite CLI

Use o comando nativo do SQLite quando disponivel:

```bash
sqlite3 /app/data/zippcrm.db ".backup '/app/data/backups/zippcrm-$(date +%Y%m%d-%H%M%S).db'"
```

Se `sqlite3` nao estiver disponivel no ambiente e o utilitario `npm run db:backup` nao puder ser usado, pare a aplicacao antes de copiar arquivos:

```bash
docker compose stop app
mkdir -p backups
cp /path/to/zippcrm.db* backups/
docker compose start app
```

## Restore

1. Parar a aplicacao.
2. Preservar o banco atual antes de sobrescrever.
3. Remover arquivos WAL/SHM antigos do destino, se existirem.
4. Copiar o backup para o caminho configurado em `DATABASE_PATH`.
5. Ajustar permissao do arquivo para o usuario da aplicacao.
6. Subir a aplicacao.
7. Validar `/api/health` e fluxos criticos.

Docker:

```bash
docker compose stop app
BACKUP_FILE=zippcrm.db.20260615-120000.bak
docker run --rm -v zippcrm-sqlite-data:/data -v "$PWD/backups:/backups" alpine sh -c \
  "test -f /backups/$BACKUP_FILE && cp /data/zippcrm.db /data/zippcrm.db.before-restore && rm -f /data/zippcrm.db-wal /data/zippcrm.db-shm && cp /backups/$BACKUP_FILE /data/zippcrm.db && chown 1001:1001 /data/zippcrm.db"
docker compose start app
curl -f http://localhost:6000/api/health
```

## Politica Minima Para Go-Live

- Backup diario automatizado.
- Retencao minima de 7 dias.
- Teste de restore antes do go-live.
- Backup manual antes de qualquer migracao.
- Registro do horario, responsavel e hash/tamanho do arquivo de backup.
