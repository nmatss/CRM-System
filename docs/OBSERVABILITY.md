# Observabilidade, SLOs e alertas

Fase 9 do plano de conclusao. Este documento descreve o que o sistema realmente
emite hoje e como alertar sobre isso. Nada aqui pressupoe um provedor externo
contratado.

## O que o sistema emite

| Sinal               | Origem                                             | Onde                                                                                |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Liveness            | `GET /api/health`                                  | publico, nao consulta o banco                                                       |
| Readiness           | `GET /api/ready`                                   | publico, faz uma consulta barata                                                    |
| Identidade do build | `/api/health`, todo log e `zippcrm_build_info`     | versao, commit e instante do build                                                  |
| Logs estruturados   | stdout em JSON                                     | com `requestId`, `build`, `tenantId` quando aplicavel e redacao de campos sensiveis |
| Metricas            | `GET /api/v1/admin/metrics`                        | formato Prometheus, restrito a super admin                                          |
| Backlog da outbox   | `GET /api/v1/admin/diagnostics/outbox`             | leitura humana, restrito a super admin                                              |
| Auditoria           | `GET /api/v1/audit-events` e `/admin/audit-events` | eventos append-only                                                                 |

### Metricas publicadas

- `zippcrm_build_info{version,commit,built_at}` — identidade do artefato.
- `zippcrm_process_uptime_seconds` — reinicios aparecem como queda a zero.
- `zippcrm_database_up` — 1 quando a ultima verificacao de readiness respondeu.
- `zippcrm_http_requests_total{route,status}` — contador por padrao de rota e
  classe de status. O rotulo e o **padrao** (`/api/v1/customers/{id}`), nunca a
  URL bruta: usar a URL criaria uma serie por identificador.
- `zippcrm_http_request_duration_ms_bucket|_sum|_count{route}` — histograma de
  latencia.
- `zippcrm_http_route_samples_dropped_total` — amostras descartadas pelo teto de
  200 rotas distintas. Diferente de zero significa que a cardinalidade estourou
  e o teto precisa ser revisto.
- `zippcrm_outbox_jobs{state}` — `pending`, `processing`, `retry_wait` e
  `dead_letter`.

## Coleta

O endpoint exige sessao de super admin, entao o scraper precisa de credencial.
Em Prometheus, use um job com `bearer_token`/cookie fornecido pela plataforma ou
exponha o endpoint apenas na rede interna. Nao remova a protecao: as metricas
revelam o perfil de trafego e o backlog de toda a instalacao.

```yaml
scrape_configs:
  - job_name: zippcrm
    metrics_path: /api/v1/admin/metrics
    scheme: https
    static_configs:
      - targets: ["crm.example.com"]
```

## SLOs

Definidos para a arquitetura atual: um processo Node com SQLite embarcado e
worker no mesmo processo. Janela de avaliacao: 30 dias corridos.

| SLO                     | Objetivo                                   | Como medir                                        |
| ----------------------- | ------------------------------------------ | ------------------------------------------------- |
| Disponibilidade da API  | 99,5% das requisicoes sem resposta 5xx     | `1 - rate(5xx) / rate(total)`                     |
| Latencia de leitura     | 95% abaixo de 500 ms                       | histograma de `zippcrm_http_request_duration_ms`  |
| Latencia de escrita     | 95% abaixo de 1 s                          | mesmo histograma, rotas de mutacao                |
| Tempo na fila da outbox | 95% dos jobs processados em ate 5 min      | `zippcrm_outbox_jobs{state="pending"}` sustentado |
| Entrega de campanha     | zero destinatario em `pending` apos 30 min | `campaign_recipients`                             |

**RPO e RTO.** Com backup diario automatizado e retencao de 14 copias, o RPO e
de 24 horas e o RTO medido no ensaio de restauracao foi inferior a 5 minutos
(copiar o `.bak` para o volume e reiniciar o processo). Reduzir o RPO exige
backup mais frequente, o que o mesmo script suporta apenas mudando o agendador.

## Desempenho medido

`server/__tests__/performance.test.ts` popula um tenant com 4.000 clientes,
500 produtos, 4.000 pedidos e 4.000 itens e mede os caminhos de leitura. Valores
observados em maquina de desenvolvimento (SQLite local, Node 20.19.0):

| Caminho                             | Medido   | Orcamento no teste |
| ----------------------------------- | -------- | ------------------ |
| Listagem paginada de clientes       | 1,1 ms   | 400 ms             |
| Pagina profunda (offset ~3.940)     | 3,1 ms   | 500 ms             |
| Busca textual com filtro            | 3,0 ms   | 500 ms             |
| Relatorio de vendas do mes inteiro  | 32,0 ms  | 1.500 ms           |
| Composicao do dashboard             | 27,3 ms  | 1.500 ms           |
| Claim na outbox com 2.000 pendentes | < 100 ms | 100 ms             |

Os orcamentos sao folgados de proposito: o teste existe para detectar um full
scan acidental ou um N+1 introduzido por regressao, nao para policiar variacao
de milissegundos em runner compartilhado. Se a margem cair de forma sustentada,
o gargalo deve ser investigado antes de afrouxar o orcamento.

## Regras de alerta

```yaml
groups:
  - name: zippcrm
    rules:
      - alert: ZippcrmDown
        expr: up{job="zippcrm"} == 0
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Instancia do CRM nao responde ao scrape"
          runbook: "RUNBOOK_PRODUCAO.md#aplicacao-nao-inicia-em-producao"

      - alert: ZippcrmDatabaseDown
        expr: zippcrm_database_up == 0
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Banco nao respondeu a verificacao de readiness"
          runbook: "RUNBOOK_PRODUCAO.md#healthcheck-com-banco-desconectado"

      - alert: ZippcrmHighErrorRate
        expr: |
          sum(rate(zippcrm_http_requests_total{status="5xx"}[5m]))
            / sum(rate(zippcrm_http_requests_total[5m])) > 0.005
        for: 10m
        labels: { severity: critical }
        annotations:
          summary: "Taxa de erro 5xx acima do orcamento do SLO"

      - alert: ZippcrmSlowReads
        expr: |
          histogram_quantile(
            0.95,
            sum(rate(zippcrm_http_request_duration_ms_bucket[5m])) by (le)
          ) > 500
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "p95 de latencia acima de 500 ms"

      - alert: ZippcrmOutboxBacklog
        expr: zippcrm_outbox_jobs{state="pending"} > 100
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "Backlog da outbox acima do SLO de tempo na fila"
          runbook: "RUNBOOK_PRODUCAO.md#outbox-e-worker-embutido"

      - alert: ZippcrmDeadLetter
        expr: increase(zippcrm_outbox_jobs{state="dead_letter"}[1h]) > 0
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Job foi para dead_letter e precisa de analise humana"
          runbook: "RUNBOOK_PRODUCAO.md#job-preso-em-processing"

      - alert: ZippcrmMetricCardinality
        expr: increase(zippcrm_http_route_samples_dropped_total[1h]) > 0
        for: 10m
        labels: { severity: info }
        annotations:
          summary: "Teto de rotas distintas atingido; metricas incompletas"
```

## Rastreamento de erros

Nao ha integracao com servico de error tracking. Erros nao tratados sao
registrados em JSON com `requestId` e `build`, e a taxa de 5xx e alertavel pelas
regras acima. Adotar Sentry ou equivalente e uma decisao em aberto; enquanto
nao existir, o par log estruturado + alerta de taxa de erro e o mecanismo
oficial e nenhum documento deve afirmar o contrario.

## Limites conhecidos

- As metricas sao por processo e zeram no reinicio, o que e o esperado para
  contadores Prometheus.
- Com mais de uma instancia servindo a mesma base, os contadores precisam ser
  agregados por instancia; a arquitetura atual pressupoe uma unica instancia
  gravando no volume SQLite (ADR 0001).
- Nao ha tracing distribuido. O `requestId` propagado por `x-request-id` cumpre
  o papel de correlacao dentro do processo.
