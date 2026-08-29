# ADR 0001 — Outbox durável e worker embutido

- **Status:** aceito e implementado na migration 0008 (campanhas e automações). Providers reais continuam pendentes de decisão.
- **Data:** 2026-08-29
- **Escopo:** campanhas, notificações e automações

## Contexto

O runtime atual é um único processo Express com SQLite. Campanhas e automações já possuem configuração persistida, mas não existe fila, worker ou provedor de entrega operacional. Marcar uma campanha como enviada sem executar e registrar cada destinatário produz sucesso fictício e impede retry, reconciliação e suporte.

Trocar banco ou introduzir um broker externo agora aumentaria a operação antes de existir volume medido. Ao mesmo tempo, executar provedores dentro da requisição HTTP não oferece atomicidade entre a mudança de negócio e o agendamento, nem uma política segura de retry.

## Decisão

Será usada uma outbox no mesmo SQLite e um worker embutido no processo da aplicação.

1. A mutação de negócio e a inclusão do job na outbox ocorrerão na mesma transação SQLite.
2. Cada job terá tenant, tipo, payload versionado, chave idempotente, estado, tentativas, instante da próxima tentativa, lease e timestamps.
3. O worker reivindicará jobs por lease com atualização condicional. Um lease expirado permitirá recuperação após queda do processo.
4. Falhas transitórias usarão backoff exponencial com jitter e limite de tentativas. Falhas permanentes ou esgotadas irão para `dead_letter`.
5. O shutdown gracioso parará novas reivindicações e aguardará apenas o job em execução dentro de um prazo limitado.
6. O payload armazenará IDs e dados mínimos necessários; não armazenará secrets de provider e evitará duplicar PII quando ela puder ser resolvida no momento do envio.
7. Adaptadores de email, SMS e WhatsApp falharão fechados quando não configurados. Nenhum adapter poderá inventar ID de entrega ou converter ausência de provider em sucesso.
8. Cada tentativa e transição de estado será observável e correlacionada por `requestId`/`jobId`, sem registrar destinatário ou conteúdo da mensagem.
9. Campanhas terão execuções e destinatários persistidos. Métricas de envio, abertura, conversão e receita permanecerão indisponíveis até haver eventos reais e regra de atribuição aprovada.
10. Automações terão definição versionada e execuções persistidas. Somente triggers, condições e ações explicitamente suportadas poderão ser ativadas.

## Modelo de estados

```text
pending -> processing -> succeeded
   ^           |
   |           +-> retry_wait -> pending
   |           |
   +-----------+
               +-> dead_letter
```

Cancelamento só será aceito antes de `processing`. A repetição da mesma chave idempotente com o mesmo payload retornará o job existente; payload divergente retornará conflito.

## Limites operacionais e evolução

O worker embutido é adequado enquanto houver uma instância gravando no volume SQLite, latência de fila aceitável e volume moderado. A migração para broker/worker separado deverá ser reavaliada quando qualquer condição ocorrer de forma sustentada:

- necessidade de mais de uma instância de aplicação escrevendo simultaneamente;
- backlog acima do SLO por 15 minutos;
- jobs longos competindo com requisições HTTP;
- throughput de entrega superior ao suportado pelo rate limit dos adapters;
- necessidade de isolamento operacional entre API e processamento.

A troca futura preservará o contrato de job, chave idempotente e estados. Ela não autoriza dual-write sem plano de cutover, reconciliação e rollback.

## Segurança e privacidade

- O tenant vem do contexto autenticado do servidor, nunca do payload do cliente.
- Jobs, execuções e destinatários terão filtros e guards cross-tenant.
- Apenas manager poderá criar, agendar, cancelar ou reprocessar campanhas e automações.
- Webhooks futuros exigirão verificação de assinatura, timestamp, replay protection e idempotência antes de alterar estado.
- Opt-out e consentimento serão avaliados no momento de materializar destinatários e novamente antes da entrega.
- Credenciais existirão somente em variáveis/secret store da plataforma e nunca no SQLite, payload, log ou resposta HTTP.

## Consequências

### Positivas

- atomicidade com o banco atual;
- execução retomável e auditável;
- ausência de novo serviço operacional na primeira versão;
- caminho explícito para providers e broker futuros.

### Custos e riscos

- o worker compete por CPU e I/O com a API;
- SQLite continua sendo ponto único de disponibilidade;
- leases, retries e shutdown precisam de testes temporais determinísticos;
- envio externo continua bloqueado até adapter, consentimento e credenciais serem aprovados.

## Critérios de aceite da implementação

- testes de idempotência, lease expirado, retry, dead-letter e recuperação após reinício;
- teste de rollback provando que mutação e enqueue são atômicos;
- testes positivos e negativos cross-tenant;
- nenhum endpoint retorna sucesso de entrega sem resultado persistido do adapter;
- métricas e UI distinguem `agendado`, `processando`, `entregue`, `falhou` e `não configurado`;
- runbook documenta pausar worker, inspecionar backlog e reprocessar com segurança.

## Estado da implementação

Implementado e coberto por teste automatizado:

- `outbox_jobs` com chave idempotente por tenant, lease recuperável, backoff
  com jitter, dead-letter e cancelamento apenas antes do processamento;
- enfileiramento na mesma transação SQLite da mutação de negócio, provado por
  teste de rollback;
- `campaign_executions` e `campaign_recipients` com status por destinatário e
  consentimento avaliado na materialização e novamente antes da entrega;
- `automation_executions` com definição versionada, gatilhos e ações em
  allowlist, execução idempotente por evento e histórico real na UI;
- adapters que falham fechados sem provedor configurado, sem inventar ID de
  entrega e sem registrar destinatário ou conteúdo;
- worker embutido que inicia com o servidor, para de reivindicar no shutdown e
  pode ser desligado por `OUTBOX_WORKER_ENABLED=false`;
- runbook com backlog, pausa do worker, job preso e reprocessamento seguro.

Ainda não implementado: webhooks de provider, agendamento futuro de campanha,
supressão global por lista e métricas de atribuição.

## Decisões ainda necessárias

- providers e ambientes sandbox de email, SMS e WhatsApp;
- texto de consentimento, política de opt-out e retenção;
- SLO de tempo na fila e número máximo de tentativas por canal;
- política de atribuição para abertura, conversão e receita.
