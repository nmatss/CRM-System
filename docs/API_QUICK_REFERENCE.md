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
