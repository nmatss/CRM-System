# Relatorio de melhores praticas de seguranca

**Projeto:** CRM-System

**Data:** 2026-08-29

**Escopo:** React/TypeScript, Express, sessoes, SQLite/Drizzle, multi-tenancy e configuracao de producao
**Modo:** auditoria; nenhuma correcao aplicada

## Resumo executivo

O projeto possui controles positivos relevantes: sessoes server-side persistentes, cookie `HttpOnly`/`SameSite`, segredo obrigatorio em producao, regeneracao de sessao no login, CSRF, rate limits, Helmet/CSP em producao, body limit e queries parametrizadas pelo Drizzle.

Mesmo assim, o sistema nao deve ir a producao multi-tenant no estado atual. Foi confirmado um caminho critico de takeover por reset de senha global, dois caminhos altos de quebra de isolamento e lacunas estruturais que tornam a fronteira tenant dependente somente do codigo de aplicacao.

Resumo:

- Critico: 1
- Alto: 2
- Medio: 8
- Baixo: 3

## Critico

### SBP-001 — Reset de senha por gerente permite takeover entre tenants

- **Rule ID:** EXPRESS-AUTHZ/TENANT-001
- **Severidade:** CRITICO
- **Local:** `server/routes.ts:1069-1092`, `server/storage.ts:231-240`, `shared/schema.ts:75-88`
- **Evidencia:** a membership e N:N. A rota confirma apenas que o alvo pertence ao tenant do gerente e depois altera a senha na tabela global `users`.
- **Impacto:** se o usuario alvo tambem pertencer a outro tenant, o gerente pode definir sua senha, autenticar como ele e acessar as demais memberships. O impacto e takeover de conta e potencial acesso cross-tenant.
- **Correcao:** remover o reset direto de credencial global por gerente tenant. Usar reset one-time iniciado/confirmado pelo usuario ou impedir a operacao quando a identidade possuir outras memberships. Registrar evento de seguranca e invalidar sessoes.
- **Mitigacao:** restringir temporariamente reset de membros ao super admin e alertar para usuarios multi-tenant ate o fluxo definitivo existir.
- **Falso positivo:** somente seria reduzido se uma regra estrutural comprovasse que usuarios nunca podem ter mais de uma membership. O schema e o painel admin permitem N:N, portanto a pre-condicao existe.

## Alto

### SBP-002 — Membership revogada conserva acesso de leitura

- **Rule ID:** EXPRESS-AUTHZ/TENANT-002
- **Severidade:** ALTO
- **Local:** `server/auth.ts:91-142`, `server/auth.ts:165-212`, `server/routes.ts:1203-1210`, `server/routes.ts:2210-2223`, `server/routes.ts:2490-2525`
- **Evidencia:** `requireAuth` revalida apenas usuario global/status/senha. Muitas leituras e exportacoes derivam `tenantId` da sessao sem revalidar tenant ou membership. `requireTenantAccess` existe e e testado, mas nao protege as rotas reais.
- **Impacto:** usuario removido ou desativado em uma empresa pode continuar lendo e exportando dados durante a sessao; `POST /customer-interactions` tambem permanece disponivel com membership obsoleta.
- **Correcao:** middleware unico de contexto tenant em toda rota tenant-scoped, carregando tenant ativo, membership ativa e role atual a cada request ou com cache revogavel seguro.
- **Mitigacao:** invalidar todas as sessoes ao remover membership/tenant enquanto o middleware nao for aplicado.
- **Falso positivo:** a escrita que usa `requireRole` revalida membership; o achado se aplica as rotas que usam somente `requireAuth`.

### SBP-003 — Mass assignment permite mover registros para outro tenant

- **Rule ID:** EXPRESS-INPUT-001 / TENANT-003
- **Severidade:** ALTO
- **Local:** `server/routes.ts:1265-1275`, `server/routes.ts:1382-1392`, `server/routes.ts:1497-1507`, `server/routes.ts:1784-1794`, `server/storage.ts:343-347`, `server/storage.ts:388-392`, `server/storage.ts:433-437`, `server/storage.ts:614-618`
- **Evidencia:** quatro PUTs passam `req.body` bruto para `.set(data)`. O `WHERE` valida o tenant antigo, mas o update pode escrever um novo `tenant_id`.
- **Impacto:** seller/manager pode remover a entidade da empresa de origem e injeta-la em outra empresa conhecida, quebrando confidencialidade/integridade operacional.
- **Correcao:** schemas de update `.partial().omit({ tenantId: true, ...camposImutaveis })`, allowlists explicitas e defesa adicional no storage para nunca aceitar `tenantId` em update.
- **Mitigacao:** bloquear/rejeitar a chave `tenantId` globalmente nos endpoints afetados ate a refatoracao.
- **Falso positivo:** nao depende de UI; um cliente HTTP pode enviar a chave diretamente.

## Medio

### SBP-004 — Relacionamentos podem apontar para entidades de outro tenant

- **Rule ID:** TENANT-REL-001
- **Severidade:** MEDIO
- **Local:** `shared/schema.ts:186-209`, `shared/schema.ts:246-269`, `shared/schema.ts:389-474`, `server/routes.ts:1471-1478`, `server/routes.ts:1992-2003`, `server/routes.ts:2090-2119`, `server/routes.ts:2158-2187`
- **Evidencia:** FKs referenciam apenas IDs globais. As criacoes nao validam consistentemente que cliente, regra, pedido, tarefa e vendedor pertencem ao tenant ativo.
- **Impacto:** corrupcao de dados cross-tenant e efeitos de cascade entre empresas; joins podem retornar relacionamentos incompletos ou inconsistentes.
- **Correcao:** validar todas as referencias por `(tenantId, id)` e adotar constraints/indices compostos quando viavel.
- **Mitigacao:** validacao explicita no servico de dominio antes de cada insert.
- **Falso positivo:** o banco local auditado nao continha anomalias, mas isso nao constitui protecao preventiva.

### SBP-005 — Gerente altera perfil global compartilhado

- **Rule ID:** TENANT-IDENTITY-001
- **Severidade:** MEDIO
- **Local:** `server/routes.ts:1036-1061`, `shared/schema.ts:42-88`
- **Evidencia:** apos validar membership local, `PUT /team/:userId` altera `users.name` e `users.phone`, atributos globais.
- **Impacto:** alteracao feita por tenant A aparece em tenant B e pode afetar contato/identidade do usuario.
- **Correcao:** separar atributos globais daqueles pertencentes a membership/perfil tenant ou exigir autocuidado/super admin para atributos globais.
- **Mitigacao:** limitar gerente a role e atributos exclusivos da membership.
- **Falso positivo:** depende da decisao de produto; com usuarios multi-tenant, o efeito global e real.

### SBP-006 — Politica de senha e unicidade de email inconsistentes

- **Rule ID:** EXPRESS-AUTH-001 / INPUT-001
- **Severidade:** MEDIO
- **Local:** `shared/schema.ts:524-548`, `shared/schema.ts:42-62`, `server/routes.ts:424-457`, `server/storage.ts:207-219`
- **Evidencia:** registro publico aceita 6 caracteres, enquanto troca/reset exigem 12. Email possui indice nao unico, nao normalizado, e o check-before-insert nao evita corrida.
- **Impacto:** credenciais mais fracas no cadastro, identidades duplicadas por caixa/espaco e comportamento de login ambiguo.
- **Correcao:** politica unica, normalizacao canonica e indice unico via migration incremental com preflight de duplicatas.
- **Mitigacao:** desabilitar registro publico ou elevar validacao de senha imediatamente.
- **Falso positivo:** nenhum email duplicado foi encontrado no banco local, mas o schema permite duplicacao.

### SBP-007 — Operacoes multi-entidade nao sao transacionais

- **Rule ID:** DATA-INTEGRITY-001
- **Severidade:** MEDIO
- **Local:** `server/routes.ts:349-405`, `server/routes.ts:973-1019`
- **Evidencia:** cadastro cria usuario, tenant e membership sequencialmente; equipe cria usuario e membership em chamadas separadas.
- **Impacto:** falha intermediaria deixa usuario/tenant orfao e pode produzir estado de autorizacao inesperado.
- **Correcao:** servicos de dominio com transacao SQLite/Drizzle e tratamento explicito de conflito.
- **Mitigacao:** reconciliacao de orfaos e cleanup compensatorio auditado.
- **Falso positivo:** o risco exige falha intermediaria, mas nao existe rollback atual.

### SBP-008 — Ausencia de RLS torna a aplicacao a unica fronteira tenant

- **Rule ID:** TENANT-DEFENSE-001
- **Severidade:** MEDIO
- **Local:** `server/storage.ts:314-446`, `shared/schema.ts:122-502`
- **Evidencia:** SQLite nao fornece RLS equivalente ao PostgreSQL; filtros de tenant dependem de cada rota e query.
- **Impacto:** uma unica omissao/mass assignment pode quebrar isolamento, como demonstrado nos achados anteriores.
- **Correcao:** contexto tenant obrigatorio, repositories tenant-scoped, testes mecanicos de todas as rotas e constraints compostas.
- **Mitigacao:** revisao automatizada que proiba metodos tenant-scoped sem `tenantId` e testes negativos por entidade.
- **Falso positivo:** e uma limitacao arquitetural, nao uma vulnerabilidade isolada. A severidade cresce quando controles de aplicacao falham.

### SBP-009 — Vulnerabilidade alta transitiva no parser de IP

- **Rule ID:** EXPRESS-DEPS-001
- **Severidade:** MEDIO no contexto atual; advisory classificado como alto
- **Local:** `package-lock.json:6408`, dependencia `express-rate-limit@8.5.2 -> ip-address@10.2.0`
- **Evidencia:** `npm audit --omit=dev` reportou advisories de classificacao incorreta/bypass de fronteira para IPv4 com zeros, CIDR, IPv4-mapped e NAT64.
- **Impacto:** pode afetar controles que dependem da normalizacao de IP, inclusive rate limiting/proxy. O projeto nao possui fetch SSRF server-side, reduzindo parte do impacto do advisory.
- **Correcao:** atualizar dependencia/lockfile para versao corrigida compativel e repetir check, testes, build, audit e testes de proxy/rate limit.
- **Mitigacao:** confiar somente em proxy conhecido que sobrescreva forwarded headers e monitorar chaves de rate limit anormais.
- **Falso positivo:** o caminho SSRF nao foi encontrado, mas a biblioteca participa do rate limiting real.

### SBP-010 — Falta de audit log para operacoes privilegiadas

- **Rule ID:** SECURITY-AUDIT-001
- **Severidade:** MEDIO
- **Local:** `server/routes.ts:537-850`, `server/routes.ts:1036-1124`, `server/logger.ts:47-82`
- **Evidencia:** criacao/exclusao de tenant/usuario, role, reset de senha e exportacoes nao geram uma trilha imutavel consultavel.
- **Impacto:** incidentes e mudancas privilegiadas nao podem ser atribuidos/reconciliados com confianca.
- **Correcao:** tabela/servico de audit com ator, tenant, acao, alvo, resultado, timestamp, request ID e campos redigidos.
- **Mitigacao:** logs estruturados centralizados com retencao e acesso restrito.
- **Falso positivo:** logs de aplicacao pontuais existem, mas nao equivalem a audit trail consistente.

### SBP-014 — Stub de notificacao registra destinatario e conteudo integral

- **Rule ID:** LOGGING-PII-001
- **Severidade:** MEDIO
- **Local:** `server/services/notifications.ts:17-93`
- **Evidencia:** os stubs de email, SMS e WhatsApp escrevem em `console.log` o identificador do destinatario, titulo, mensagem, tenant e objeto `data`, e em seguida retornam sucesso ficticio.
- **Impacto:** mensagens e dados pessoais/comerciais podem ser enviados para logs sem politica de acesso/retencao; o sucesso simulado tambem mascara falha de entrega.
- **Correcao:** nao registrar corpo/destinatario; usar logger estruturado com redaction e apenas IDs tecnicos. O provider real deve persistir estado, erro e correlation ID sem conteudo sensivel.
- **Mitigacao:** desativar o stub em producao e impedir chamadas aos canais enquanto nao houver adaptador seguro.
- **Falso positivo:** o risco depende do servico ser invocado; o codigo executavel de logging existe e nao possui guarda de ambiente.

## Baixo

### SBP-011 — Erros internos e ambiente podem aparecer no health/handler

- **Rule ID:** EXPRESS-ERROR-001
- **Severidade:** BAIXO
- **Local:** `server/routes.ts:196-224`, `server/index.ts:97-121`
- **Evidencia:** health retorna `error.message` e `environment`; handler global usa `err.message` para a resposta.
- **Impacto:** exposicao de detalhes internos, caminhos ou tecnologia em falhas inesperadas.
- **Correcao:** resposta 500 generica com request ID; detalhe somente em logger redigido.
- **Mitigacao:** edge/proxy pode ocultar, mas isso deve ser verificado em runtime.
- **Falso positivo:** as rotas atuais frequentemente retornam mensagens genericas; o risco permanece no fallback.

### SBP-012 — Limites de query sem teto

- **Rule ID:** EXPRESS-BODY/DOS-001
- **Severidade:** BAIXO
- **Local:** `server/routes.ts:2142-2149`, `server/routes.ts:2541-2548`, `server/routes.ts:2652-2659`
- **Evidencia:** `limit` aceita valor negativo ou arbitrariamente alto.
- **Impacto:** consultas/respostas maiores que o esperado e pressao de memoria/latencia.
- **Correcao:** parser central com inteiro positivo e teto documentado.
- **Mitigacao:** rate limit geral reduz frequencia, nao custo por request.
- **Falso positivo:** depende do comportamento do SQLite/Drizzle para limites negativos, mas valores altos sao aceitos.

### SBP-013 — UUID de usuario usa `Math.random`

- **Rule ID:** PUBLIC-ID-001
- **Severidade:** BAIXO
- **Local:** `shared/schema.ts:6-13`, `shared/schema.ts:42-44`
- **Evidencia:** IDs UUID-like sao construidos com `Math.random`, que nao e criptograficamente seguro.
- **Impacto:** menor entropia/predicao e risco desnecessario de colisao/enumeracao de IDs publicos.
- **Correcao:** usar `crypto.randomUUID()` no servidor.
- **Mitigacao:** autorizacao server-side correta deve continuar sendo a barreira, independentemente do ID.
- **Falso positivo:** nao foi demonstrada colisao ou acesso baseado apenas no ID.

## Controles positivos verificados

- sessao SQLite persistente, sem MemoryStore;
- cookie customizado `zippcrm.sid`, `HttpOnly`, `SameSite=Lax` e `Secure` em producao;
- segredo de sessao obrigatorio e sem placeholder em producao;
- regeneracao de sessao no login;
- invalidacao por `lastPasswordChange`;
- CSRF HMAC ligado a sessao e comparacao timing-safe;
- rate limit geral, por IP e por conta;
- body limit de 1 MB;
- Helmet/CSP em producao;
- CORS permissivo nao habilitado;
- queries Drizzle parametrizadas;
- nenhum `child_process`, upload arbitrario, redirect controlado pelo usuario ou fetch server-side exposto encontrado;
- frontend nao armazena token/sessao em Web Storage;
- nenhum padrao comum de chave privada/token hardcoded foi encontrado na busca automatizada.

## Ordem recomendada de correcao

1. escrever testes de reproducao para SBP-001, SBP-002 e SBP-003;
2. corrigir SBP-001 isoladamente e invalidar sessoes;
3. criar contexto tenant e corrigir SBP-002;
4. aplicar allowlists/storage guard e corrigir SBP-003;
5. validar relacionamentos de SBP-004;
6. corrigir identidade, transacoes e constraints;
7. remover logging de conteudo e impedir sucesso ficticio de notificacoes;
8. atualizar dependencias e repetir todos os gates;
9. adicionar audit log e hardening de erros/limites/IDs.

Cada achado deve ser corrigido em ciclo pequeno com check, teste unitario, teste de integracao cross-tenant, build e revisao de diff antes de avancar.
