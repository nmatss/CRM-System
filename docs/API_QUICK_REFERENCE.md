# ZippiCRM API Quick Reference

## Base URL

- Development: `http://localhost:5000`
- Production: `https://api.zippi.crm`

## Authentication

Session-based (cookie: `connect.sid`)

---

## Endpoints Overview

### Health Check

| Method | Endpoint      | Auth | Description              |
| ------ | ------------- | ---- | ------------------------ |
| GET    | `/api/health` | No   | Cheap process liveness   |
| GET    | `/api/ready`  | No   | Cheap database readiness |

### Authentication

| Method | Endpoint                | Auth | Role | Description          |
| ------ | ----------------------- | ---- | ---- | -------------------- |
| POST   | `/api/v1/auth/login`    | No   | -    | User login           |
| POST   | `/api/v1/auth/logout`   | No   | -    | User logout          |
| GET    | `/api/v1/auth/me`       | Yes  | Any  | Get current user     |
| POST   | `/api/v1/auth/register` | No   | -    | Register new account |

### Customers

| Method | Endpoint                 | Auth | Role           | Description        |
| ------ | ------------------------ | ---- | -------------- | ------------------ |
| GET    | `/api/v1/customers`      | Yes  | Any            | List all customers |
| POST   | `/api/v1/customers`      | Yes  | Manager/Seller | Create customer    |
| PUT    | `/api/v1/customers/{id}` | Yes  | Manager/Seller | Update customer    |
| DELETE | `/api/v1/customers/{id}` | Yes  | Manager/Seller | Delete customer    |

### Products

| Method | Endpoint                | Auth | Role    | Description       |
| ------ | ----------------------- | ---- | ------- | ----------------- |
| GET    | `/api/v1/products`      | Yes  | Any     | List all products |
| POST   | `/api/v1/products`      | Yes  | Manager | Create product    |
| PUT    | `/api/v1/products/{id}` | Yes  | Manager | Update product    |
| DELETE | `/api/v1/products/{id}` | Yes  | Manager | Delete product    |

### Orders

| Method | Endpoint              | Auth | Role           | Description               |
| ------ | --------------------- | ---- | -------------- | ------------------------- |
| GET    | `/api/v1/orders`      | Yes  | Any            | List all orders           |
| POST   | `/api/v1/orders`      | Yes  | Manager/Seller | Create order              |
| PUT    | `/api/v1/orders/{id}` | Yes  | Manager/Seller | Update order              |
| DELETE | `/api/v1/orders/{id}` | Yes  | Manager/Seller | Idempotently cancel order |

---

## Request/Response Examples

### Login

```bash
POST /api/v1/auth/login
{
  "username": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "isSuperAdmin": false,
    "tenantId": 1,
    "role": "manager"
  },
  "message": "Login realizado com sucesso"
}
```

### Create Customer

```bash
POST /api/v1/customers
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "phone": "+55 11 98765-4321",
  "segment": "VIP",
  "ltv": 5420.50
}

Response: 201 Created
{
  "id": 1,
  "tenantId": 1,
  "name": "Maria Silva",
  "email": "maria@example.com",
  "phone": "+55 11 98765-4321",
  "segment": "VIP",
  "ltv": 5420.50,
  "createdAt": "2024-12-15T23:30:00Z",
  "updatedAt": "2024-12-15T23:30:00Z"
}
```

### Create Product

```bash
POST /api/v1/products
{
  "name": "Wireless Headphones",
  "category": "Electronics",
  "price": 299.99,
  "stock": 45,
  "status": "active"
}

Response: 201 Created
{
  "id": 1,
  "tenantId": 1,
  "name": "Wireless Headphones",
  "category": "Electronics",
  "price": 299.99,
  "stock": 45,
  "status": "active",
  "createdAt": "2024-12-15T23:30:00Z",
  "updatedAt": "2024-12-15T23:30:00Z"
}
```

### Create Order

```bash
POST /api/v1/orders
{
  "orderId": "ORD-2024-001",
  "customer": "Maria Silva",
  "customerId": 1,
  "total": 599.98,
  "items": 2,
  "method": "credit_card",
  "status": "completed"
}

Response: 201 Created
{
  "id": 1,
  "tenantId": 1,
  "orderId": "ORD-2024-001",
  "customer": "Maria Silva",
  "customerId": 1,
  "total": 599.98,
  "status": "completed",
  "items": 2,
  "method": "credit_card",
  "orderDate": "2024-12-15T23:30:00Z",
  "createdAt": "2024-12-15T23:30:00Z",
  "updatedAt": "2024-12-15T23:30:00Z"
}
```

---

## Common Error Responses

### 401 Unauthorized

```json
{
  "error": "Não autenticado"
}
```

### 403 Forbidden

```json
{
  "error": "Permissão insuficiente"
}
```

### 404 Not Found

```json
{
  "error": "Cliente não encontrado"
}
```

### 400 Bad Request

```json
{
  "error": "Dados inválidos"
}
```

### Campaigns and delivery

| Method | Endpoint                                                | Auth | Role    | Description                                       |
| ------ | ------------------------------------------------------- | ---- | ------- | ------------------------------------------------- |
| GET    | `/api/v1/campaigns`                                     | Yes  | Any     | List campaigns                                    |
| POST   | `/api/v1/campaigns`                                     | Yes  | Manager | Create a draft                                    |
| PUT    | `/api/v1/campaigns/{id}`                                | Yes  | Manager | Update the definition                             |
| DELETE | `/api/v1/campaigns/{id}`                                | Yes  | Manager | Delete                                            |
| POST   | `/api/v1/campaigns/{id}/send`                           | Yes  | Manager | Request a dispatch (202); never confirms delivery |
| GET    | `/api/v1/campaigns/executions`                          | Yes  | Any     | Persisted executions                              |
| GET    | `/api/v1/campaigns/executions/{executionId}/recipients` | Yes  | Any     | Per-recipient delivery status                     |
| GET    | `/api/v1/campaigns/stats`                               | Yes  | Any     | Counters and delivery statistics                  |
| GET    | `/api/v1/campaigns/templates`                           | Yes  | Any     | Templates the dispatcher can execute              |

`POST /campaigns/{id}/send` is idempotent per campaign definition: repeating it
without editing the campaign returns the existing execution with status 200
instead of scheduling a second one.

### Automations

| Method | Endpoint                           | Auth | Role    | Description                          |
| ------ | ---------------------------------- | ---- | ------- | ------------------------------------ |
| GET    | `/api/v1/automations`              | Yes  | Any     | List automations                     |
| POST   | `/api/v1/automations`              | Yes  | Manager | Create (allowlisted trigger/action)  |
| PUT    | `/api/v1/automations/{id}`         | Yes  | Manager | Update; bumps the version            |
| DELETE | `/api/v1/automations/{id}`         | Yes  | Manager | Delete                               |
| PATCH  | `/api/v1/automations/{id}/toggle`  | Yes  | Manager | Activate or pause                    |
| GET    | `/api/v1/automations/history`      | Yes  | Any     | Real execution history               |
| GET    | `/api/v1/automations/capabilities` | Yes  | Any     | Executable triggers/actions/channels |

---

## Delivery states

A recipient or automation execution never reports a delivery that a provider
did not acknowledge.

| State             | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `pending`         | Queued; the worker has not finished this recipient yet      |
| `delivered`       | A provider returned an acknowledgement with a message ID    |
| `failed`          | The provider refused or the attempts were exhausted         |
| `skipped_opt_out` | The recipient opted out of marketing                        |
| `not_configured`  | No provider is configured for the channel; nothing was sent |

---

## User Roles & Permissions

| Role            | Customers     | Products    | Orders        |
| --------------- | ------------- | ----------- | ------------- |
| **super_admin** | Full Access   | Full Access | Full Access   |
| **manager**     | Full Access   | Full Access | Full Access   |
| **seller**      | Create/Update | Read Only   | Create/Update |

---

## Data Enums

### Customer Segments

- `Novo` - New customer
- `Regular` - Regular customer
- `VIP` - VIP customer
- `Em Risco` - At-risk customer
- `Inativo` - Inactive customer

### Order Status

- `pending` - Pending
- `processing` - Processing
- `completed` - Completed
- `cancelled` - Cancelled

### Product Status

- `active` - Active
- `inactive` - Inactive

---

For complete API documentation, see `openapi.yaml`
