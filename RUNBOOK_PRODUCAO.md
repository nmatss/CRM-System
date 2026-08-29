# Runbook De Producao

## Healthcheck

```bash
curl -f https://<host>/api/health
```

Resposta esperada:

```json
{
  "status": "healthy",
  "database": "connected"
}
```

## Logs

Os logs HTTP registram metodo, path, status e latencia. Corpos de resposta e campos sensiveis nao devem ser logados.

Campos sensiveis sao redigidos pelo logger quando aparecem em contexto: password, token, secret, session, authorization, cookie e csrf.
Stack traces sao omitidos em producao, exceto se `LOG_STACKS=true` for aprovado temporariamente para incidente.

## Incidentes Comuns

### Aplicacao Nao Inicia Em Producao

Verificar:

- `SESSION_SECRET` ausente, curto ou placeholder.
- `ADMIN_EMAIL` ausente ou invalido.
- `ADMIN_PASSWORD` ausente, curto ou placeholder.
- Volume `/app/data` sem permissao de escrita.
- Volume SQLite vazio sem `ALLOW_EMPTY_DATABASE_BOOTSTRAP=true` no primeiro boot controlado.
- `TRUST_PROXY` ausente quando o app roda atras de Render/Railway/reverse proxy confiavel.
- Railway sem `RAILWAY_VOLUME_MOUNT_PATH=/app/data`.

### Healthcheck Com Banco Desconectado

Verificar:

- `DATABASE_PATH`.
- `SESSION_DATABASE_PATH`, se configurado.
- Existencia do diretorio de dados.
- Permissao do usuario da aplicacao.
- Espaco em disco.

### Login Falhando

Verificar:

- Usuario ativo.
- Senha correta.
- Rate limit por excesso de tentativas.
- Cookie de sessao bloqueado pelo navegador/proxy.
- HTTPS em producao, pois cookie `secure` e habilitado.
- `TRUST_PROXY=1` em PaaS/reverse proxy confiavel; deixar vazio em Docker exposto diretamente.

### Mutacoes Retornando 403 CSRF

Verificar:

- Frontend buscou `GET /api/v1/csrf-token`.
- Header `X-CSRF-Token` esta presente.
- Recarregar a pagina para renovar token.
- Cliente usa `apiRequest` para POST/PUT/PATCH/DELETE.

## Rollback

1. Confirmar backup valido do banco atual.
2. Voltar para a imagem/build anterior.
3. Em Docker, definir `APP_VERSION=<versao-anterior>` e executar `docker compose up -d --no-build`.
4. Se houve migracao de banco, parar app e restaurar backup conforme `BACKUP_RESTORE.md`.
5. Subir aplicacao.
6. Validar `/api/health`.
7. Validar login e CRUD basico.

## Backup Manual

```bash
npm run db:backup
```

Docker:

```bash
docker compose exec app npm run db:backup
```

Registrar caminho, tamanho e SHA-256 retornados.

## Controles Operacionais Minimos

- Nao alterar producao sem autorizacao explicita.
- Fazer backup antes de deploy com mudanca de banco.
- Nao registrar secrets em tickets, logs ou chat.
- Registrar comandos executados, horario, responsavel e resultado.
