# Moda CRM - Documentacao do Banco de Dados

## Visao Geral

O Moda CRM utiliza PostgreSQL como banco de dados principal, com Drizzle ORM para gerenciamento de schemas e queries. A arquitetura e multi-tenant, onde cada empresa (tenant) possui seus dados isolados.

---

## Arquitetura Multi-Tenant

```
                    +------------------+
                    |     TENANTS      |
                    +------------------+
                           |
          +----------------+----------------+
          |                |                |
    +-----------+    +-----------+    +-----------+
    | Customers |    | Products  |    |  Orders   |
    +-----------+    +-----------+    +-----------+
          |                                  |
    +-----------+                      +-----------+
    |SellerTasks|                      |OrderItems*|
    +-----------+                      +-----------+
```

**Isolamento por Tenant**: Todas as tabelas de negocio possuem `tenant_id` como chave estrangeira, garantindo que cada empresa acesse apenas seus proprios dados.

---

## Tabelas do Sistema

### 1. TENANTS (Empresas)

Armazena informacoes das empresas/lojas que utilizam o sistema.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| name | TEXT | NOT NULL | Nome da empresa |
| slug | TEXT | NOT NULL, UNIQUE | URL amigavel (ex: "loja-moda") |
| plan | TEXT | NOT NULL, DEFAULT 'free' | Plano: free, basic, premium, enterprise |
| status | TEXT | NOT NULL, DEFAULT 'active' | Status: active, suspended, cancelled |
| logo | TEXT | NULL | URL do logo |
| primary_color | TEXT | DEFAULT '#9333ea' | Cor primaria da marca |
| secondary_color | TEXT | DEFAULT '#db2777' | Cor secundaria |
| login_message | TEXT | NULL | Mensagem personalizada na tela de login |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

**Valores de Status:**
- `active`: Empresa ativa
- `suspended`: Conta suspensa (pendencia pagamento)
- `cancelled`: Conta cancelada

**Valores de Plano:**
- `free`: Plano gratuito (limitacoes de usuarios/clientes)
- `basic`: Plano basico
- `premium`: Plano premium
- `enterprise`: Plano empresarial

---

### 2. USERS (Usuarios)

Usuarios do sistema (administradores, gerentes, vendedores).

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | VARCHAR | PK, UUID | Identificador unico (UUID) |
| email | TEXT | NULL | Email do usuario |
| cpf | TEXT | UNIQUE | CPF (usado para login) |
| seller_code | TEXT | NULL | Codigo do vendedor |
| password | TEXT | NOT NULL | Senha criptografada (bcrypt) |
| name | TEXT | NOT NULL | Nome completo |
| phone | TEXT | NULL | Telefone |
| is_super_admin | BOOLEAN | NOT NULL, DEFAULT false | E super administrador? |
| must_change_password | BOOLEAN | NOT NULL, DEFAULT true | Deve trocar senha no proximo login? |
| email_verified | BOOLEAN | NOT NULL, DEFAULT false | Email verificado? |
| status | TEXT | NOT NULL, DEFAULT 'active' | Status: active, inactive, blocked |
| last_password_change | TIMESTAMP | NULL | Ultima troca de senha |
| last_login | TIMESTAMP | NULL | Ultimo acesso |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

**Observacoes:**
- O login pode ser feito por CPF ou email
- Senha padrao inicial: codigo do vendedor ou "123456"
- Super admins tem acesso a todos os tenants

---

### 3. TENANT_USERS (Vinculo Usuario-Empresa)

Relacionamento N:N entre usuarios e empresas com papel (role).

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| user_id | VARCHAR | NOT NULL, FK(users) | ID do usuario |
| role | TEXT | NOT NULL, DEFAULT 'seller' | Papel: manager, seller |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Vinculo ativo? |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

**Papeis (Roles):**
- `manager`: Gerente - acesso total ao tenant
- `seller`: Vendedor - acesso restrito (clientes, tarefas, vendas)

---

### 4. PASSWORD_RESETS (Recuperacao de Senha)

Tokens para recuperacao de senha.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| user_id | VARCHAR | NOT NULL, FK(users) | ID do usuario |
| token | TEXT | NOT NULL, UNIQUE | Token de recuperacao |
| expires_at | TIMESTAMP | NOT NULL | Data de expiracao |
| used_at | TIMESTAMP | NULL | Data de uso |
| created_by_admin | BOOLEAN | NOT NULL, DEFAULT false | Criado por admin? |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

---

## Tabelas de Negocio (Tenant-Scoped)

### 5. CUSTOMERS (Clientes)

Cadastro de clientes da loja.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| name | TEXT | NOT NULL | Nome completo |
| email | TEXT | NOT NULL | Email |
| phone | TEXT | NULL | Telefone (formato: 5511999999999) |
| segment | TEXT | NOT NULL | Segmento: new, regular, vip, premium, inactive |
| ltv | TEXT | NOT NULL | Lifetime Value (formato: "R$ 1.234,56") |
| last_purchase | TEXT | NOT NULL | Data ultima compra (formato: YYYY-MM-DD) |
| favorite_category | TEXT | NULL | Categoria favorita |
| image | TEXT | NULL | URL da foto |
| birth_date | TEXT | NULL | Data de nascimento (formato: YYYY-MM-DD) |

**Segmentos:**
- `new`: Cliente novo (primeira compra)
- `regular`: Cliente regular
- `vip`: Cliente VIP (alto valor)
- `premium`: Cliente premium
- `inactive`: Cliente inativo (sem compras ha muito tempo)

**Observacoes sobre LTV:**
- Armazenado como texto no formato brasileiro "R$ X.XXX,XX"
- Para calculos, usar funcao de parsing que remove simbolos e converte virgula

---

### 6. PRODUCTS (Produtos)

Catalogo de produtos.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| name | TEXT | NOT NULL | Nome do produto |
| category | TEXT | NOT NULL | Categoria |
| price | TEXT | NOT NULL | Preco (formato: "R$ 199,90") |
| stock | INTEGER | NOT NULL | Quantidade em estoque |
| status | TEXT | NOT NULL | Status: active, inactive, out_of_stock |
| image | TEXT | NULL | URL da imagem |

---

### 7. ORDERS (Pedidos)

Registro de vendas/pedidos.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico interno |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| order_id | TEXT | NOT NULL | Codigo do pedido (ex: "PED-2024-001") |
| customer_id | INTEGER | FK(customers) | ID do cliente (opcional) |
| customer | TEXT | NOT NULL | Nome do cliente (denormalizado) |
| date | TEXT | NOT NULL | Data do pedido (formato: YYYY-MM-DD) |
| total | TEXT | NOT NULL | Valor total (formato: "R$ 599,90") |
| status | TEXT | NOT NULL | Status: pending, confirmed, shipped, delivered, cancelled |
| items | INTEGER | NOT NULL | Quantidade de itens |
| method | TEXT | NOT NULL | Metodo pagamento: pix, credit, debit, cash |

**Status do Pedido:**
- `pending`: Pendente
- `confirmed`: Confirmado
- `shipped`: Enviado
- `delivered`: Entregue
- `cancelled`: Cancelado

---

### 8. CASHBACK_RULES (Regras de Cashback)

Configuracao do programa de fidelidade/cashback.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| name | TEXT | NOT NULL | Nome da regra |
| trigger | TEXT | NOT NULL | Gatilho: purchase, birthday, referral, first_purchase |
| value | TEXT | NOT NULL | Valor (ex: "5%", "R$ 20,00") |
| validity | TEXT | NOT NULL | Validade (ex: "30 dias", "90 dias") |
| status | TEXT | NOT NULL | Status: active, inactive |
| usage | INTEGER | NOT NULL, DEFAULT 0 | Quantidade de usos |

---

### 9. CAMPAIGNS (Campanhas de Marketing)

Campanhas de comunicacao com clientes.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| name | TEXT | NOT NULL | Nome da campanha |
| channel | TEXT | NOT NULL | Canal: whatsapp, email, sms |
| audience | TEXT | NOT NULL | Publico-alvo (segmento) |
| sent | INTEGER | NOT NULL, DEFAULT 0 | Quantidade enviada |
| open_rate | TEXT | NOT NULL | Taxa de abertura (ex: "45%") |
| conversion | TEXT | NOT NULL | Taxa de conversao (ex: "12%") |
| revenue | TEXT | NOT NULL | Receita gerada (formato monetario) |
| status | TEXT | NOT NULL | Status: draft, scheduled, running, completed |
| date | TEXT | NOT NULL | Data da campanha |

---

### 10. AUTOMATIONS (Automacoes)

Regras de automacao IFTTT-style.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| title | TEXT | NOT NULL | Titulo da automacao |
| description | TEXT | NOT NULL | Descricao |
| icon | TEXT | NOT NULL | Icone (nome do Lucide icon) |
| active | INTEGER | NOT NULL, DEFAULT 1 | Ativa? (1=sim, 0=nao) |
| stats | TEXT | NOT NULL | Estatisticas (JSON ou texto) |

---

### 11. SELLER_TASKS (Tarefas do Vendedor)

Agenda do vendedor com tarefas de clienteling.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| tenant_id | INTEGER | NOT NULL, FK(tenants) | ID da empresa |
| customer_id | INTEGER | FK(customers), ON DELETE CASCADE | ID do cliente |
| seller_id | VARCHAR | FK(users), ON DELETE SET NULL | ID do vendedor |
| type | TEXT | NOT NULL | Tipo da tarefa |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Status: pending, completed, cancelled |
| due_date | TEXT | NOT NULL | Data de vencimento (YYYY-MM-DD) |
| script | TEXT | NULL | Script de mensagem sugerido |
| notes | TEXT | NULL | Observacoes |
| completed_at | TIMESTAMP | NULL | Data de conclusao |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

**Tipos de Tarefa:**
- `aniversario`: Parabenizar cliente aniversariante
- `carrinho_abandonado`: Follow-up de carrinho abandonado
- `recompra`: Sugestao de recompra (baseado em ciclo)
- `vip_sumido`: Cliente VIP sem comprar ha muito tempo
- `manual`: Tarefa criada manualmente

---

## Tabelas Globais (Sem Tenant)

### 12. CONTACT_REQUESTS (Solicitacoes de Contato)

Formulario de contato do site institucional.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| name | TEXT | NOT NULL | Nome |
| email | TEXT | NOT NULL | Email |
| phone | TEXT | NULL | Telefone |
| message | TEXT | NOT NULL | Mensagem |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Status: pending, contacted, closed |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

---

### 13. DEMO_REQUESTS (Solicitacoes de Demo)

Agendamento de demonstracoes.

| Coluna | Tipo | Restricoes | Descricao |
|--------|------|------------|-----------|
| id | SERIAL | PK | Identificador unico |
| name | TEXT | NOT NULL | Nome do contato |
| email | TEXT | NOT NULL | Email |
| phone | TEXT | NULL | Telefone |
| company | TEXT | NOT NULL | Nome da empresa |
| store_count | TEXT | NULL | Quantidade de lojas |
| preferred_date | TEXT | NULL | Data preferida |
| message | TEXT | NULL | Mensagem adicional |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Status |
| created_at | TIMESTAMP | DEFAULT NOW() | Data de criacao |

---

## Diagrama de Relacionamentos (ERD)

```
USERS ─────────────────┐
  │                    │
  │ 1:N                │ 1:N
  ▼                    ▼
TENANT_USERS ◄──── TENANTS
  │                    │
  │                    │ 1:N (todas as tabelas abaixo)
  │                    ├──────────────────────────────┐
  │                    │                              │
  │               CUSTOMERS ◄───────────────────┐     │
  │                    │                        │     │
  │                    │ 1:N                    │     │
  │                    ▼                        │     │
  │              SELLER_TASKS                   │     │
  │                    │                        │     │
  │                    │                        │     │
  └────────────────────┘                        │     │
                                                │     │
                                           ORDERS     │
                                                │     │
                                                │     │
  PRODUCTS ◄────────────────────────────────────┼─────┤
                                                │     │
  CASHBACK_RULES ◄──────────────────────────────┼─────┤
                                                │     │
  CAMPAIGNS ◄───────────────────────────────────┼─────┤
                                                │     │
  AUTOMATIONS ◄─────────────────────────────────┴─────┘
```

---

## Indices Recomendados

```sql
-- Busca por tenant (todas as tabelas)
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_seller_tasks_tenant ON seller_tasks(tenant_id);

-- Busca de tarefas por vendedor e status
CREATE INDEX idx_seller_tasks_seller ON seller_tasks(seller_id, status);
CREATE INDEX idx_seller_tasks_due_date ON seller_tasks(tenant_id, due_date);

-- Busca de clientes por segmento
CREATE INDEX idx_customers_segment ON customers(tenant_id, segment);

-- Login por CPF
CREATE INDEX idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;
```

---

## Tabelas Futuras (Importacao de Dados)

### IMPORT_JOBS (Jobs de Importacao)

Para rastrear importacoes de dados externos.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL | PK |
| tenant_id | INTEGER | FK(tenants) |
| source | TEXT | Origem: csv, api, erp_name |
| entity_type | TEXT | Tipo: customers, products, orders |
| status | TEXT | pending, processing, completed, failed |
| total_rows | INTEGER | Total de linhas |
| processed_rows | INTEGER | Linhas processadas |
| error_rows | INTEGER | Linhas com erro |
| error_log | JSONB | Log de erros detalhado |
| started_at | TIMESTAMP | Inicio do processamento |
| completed_at | TIMESTAMP | Fim do processamento |
| created_at | TIMESTAMP | Data de criacao |

### EXTERNAL_ID_MAPPING (Mapeamento de IDs Externos)

Para vincular IDs do sistema externo com IDs internos.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL | PK |
| tenant_id | INTEGER | FK(tenants) |
| entity_type | TEXT | customers, products, orders |
| external_id | TEXT | ID no sistema externo |
| internal_id | INTEGER | ID interno |
| source | TEXT | Origem do dado |
| created_at | TIMESTAMP | Data de criacao |

**Indice Unico:** (tenant_id, entity_type, external_id, source)

---

## API de Importacao (Especificacao Futura)

### Endpoint: POST /api/import/{entity}

**Headers:**
```
Authorization: Bearer {api_key}
X-Tenant-ID: {tenant_id}
Content-Type: application/json
```

**Estrutura do Payload (Clientes):**
```json
{
  "source": "erp_totvs",
  "data": [
    {
      "external_id": "CLI001",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "phone": "5511999999999",
      "birth_date": "1990-05-15",
      "segment": "vip",
      "ltv": 8530.40,
      "last_purchase": "2024-12-01"
    }
  ]
}
```

**Estrutura do Payload (Pedidos):**
```json
{
  "source": "ecommerce_vtex",
  "data": [
    {
      "external_id": "ORD-2024-12345",
      "external_customer_id": "CLI001",
      "date": "2024-12-10",
      "total": 599.90,
      "status": "delivered",
      "items": [
        {
          "external_product_id": "PROD001",
          "name": "Vestido Floral",
          "quantity": 1,
          "unit_price": 299.90
        }
      ],
      "payment_method": "credit"
    }
  ]
}
```

---

## Regras de Integridade

1. **Cascade Delete por Tenant**: Ao deletar um tenant, todos os dados relacionados sao removidos automaticamente.

2. **Set Null em Seller**: Ao deletar um vendedor, as tarefas permanecem mas seller_id vira NULL.

3. **Cascade Delete em Customer**: Ao deletar um cliente, suas tarefas sao removidas.

4. **CPF Unico Global**: Nao podem existir dois usuarios com mesmo CPF.

5. **Slug Unico de Tenant**: Cada empresa tem URL unica.

---

## Consideracoes de Seguranca

1. **Senhas**: Armazenadas com bcrypt (hash irreversivel)

2. **Isolamento Multi-Tenant**: Todas as queries filtram por tenant_id

3. **Tokens de Reset**: Expiram apos 24 horas

4. **Dados Sensiveis**: CPF, email e telefone sao dados pessoais (LGPD)

5. **Auditoria**: Campos created_at para rastreabilidade

---

## Migracao e Sincronizacao

### Comando para sincronizar schema:
```bash
npm run db:push
```

### Forcado (cuidado com dados):
```bash
npm run db:push --force
```

### Visualizar schema atual:
```bash
npm run db:studio
```

---

## Observacoes Tecnicas

1. **Campos Monetarios**: Armazenados como TEXT no formato brasileiro. Para calculos, usar funcao de parsing.

2. **Datas**: Armazenadas como TEXT no formato ISO (YYYY-MM-DD) para simplicidade.

3. **UUIDs**: Usuarios usam UUID gerado pelo PostgreSQL (gen_random_uuid).

4. **Timestamps**: Usam tipo TIMESTAMP do PostgreSQL com timezone do servidor.

---

*Documentacao gerada para Moda CRM v1.0*
*Ultima atualizacao: Dezembro 2024*
