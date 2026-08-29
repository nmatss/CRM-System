# ADR 0002 — Dinheiro inteiro e métricas derivadas

- **Status:** aceito, migração incremental em andamento
- **Data:** 2026-08-29
- **Escopo:** catálogo, pedidos, cashback, clientes, campanhas e relatórios

## Contexto

O schema legado usa `REAL` para preço, total, LTV, gasto acumulado e receita de campanha. Ponto flutuante binário não é representação contábil segura e permite divergências entre estoque, pedido, cashback e relatório. Pedidos e o ledger de cashback já receberam colunas em centavos, mas ainda existem consumidores legados.

## Decisão

1. Todo valor monetário persistido terá uma coluna inteira `*_cents`, em centavos da moeda do tenant.
2. Cálculos de domínio, reconciliação, comparação, idempotência e agregação usarão somente inteiros.
3. Conversão para decimal formatado ocorrerá apenas na borda HTTP/UI para compatibilidade temporária.
4. Percentuais serão armazenados separadamente em basis points quando a regra exigir precisão (`10000 = 100%`); nunca compartilharão a mesma coluna com valor fixo.
5. Snapshot de preço do item de pedido é imutável. Alterar preço do produto não altera pedidos anteriores.
6. `total_spent` e `ltv` de cliente são projeções derivadas de pedidos não cancelados, não fontes de verdade financeira.
7. Receita/conversão de campanha permanecerá indisponível até existir evento de atribuição real e regra aprovada.

## Migração

Cada entidade seguirá estes gates:

1. adicionar coluna inteira sem remover a legada;
2. backfill determinístico com `ROUND(valor * 100)` e relatório de valores inválidos;
3. dual-write temporário em todos os produtores;
4. consumidores internos passam a ler centavos;
5. reconciliação prova equivalência e testes cobrem bordas de arredondamento;
6. contrato HTTP mantém decimal legado enquanto expõe centavos quando necessário;
7. coluna legada só poderá ser removida em migration futura após cutover documentado.

## Invariantes

- valores monetários não podem ser negativos, salvo tipo contábil explicitamente definido;
- `line_total_cents = unit_price_cents * quantity`;
- `order.total_cents = SUM(order_items.line_total_cents)`;
- saldo de cashback é reconciliável com lotes e último evento do ledger;
- pedidos cancelados não compõem receita nem métricas de venda;
- datas, timezone e moeda usados no relatório devem ser explícitos no contrato.

## Rollback e contenção

Durante dual support, rollback de aplicação continua lendo colunas decimais mantidas em sincronia. Uma migration não deve reescrever migrations já aplicadas nem apagar colunas antigas. Se a reconciliação falhar, o rollout é interrompido; a coluna inteira e o relatório de divergência permanecem para diagnóstico.

## Consequências

- mais colunas temporárias e disciplina de dual-write;
- relatórios passam a agregar diretamente itens/pedidos reais;
- cashback percentual/fixo exigirá schema estruturado antes de crédito automático;
- compatibilidade HTTP pode manter valores decimais, mas eles deixam de orientar decisões financeiras internas.

## Critérios de aceite

- banco novo e upgrade em cópia convergem;
- casos `0.01`, `19.99`, grandes valores e arredondamento passam;
- produto, pedido, cancelamento, cashback e relatório reconciliam em centavos;
- nenhum caminho de escrita financeiro aceita total calculado pelo cliente;
- lint, typecheck, testes de migration/integração e backup/restore passam.
