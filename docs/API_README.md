# ZippiCRM API Documentation

This directory contains the OpenAPI specification for the ZippiCRM API.

## Files

- **openapi.yaml** - Complete OpenAPI 3.0 specification with all API endpoints

## What's Documented

The OpenAPI specification includes comprehensive documentation for:

### 1. Authentication Routes
- `POST /api/auth/login` - User login with email/CPF and password
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/register` - Register new user account

### 2. Customer CRUD Operations
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### 3. Product CRUD Operations
- `GET /api/products` - List all products
- `POST /api/products` - Create new product (manager only)
- `PUT /api/products/{id}` - Update product (manager only)
- `DELETE /api/products/{id}` - Delete product (manager only)

### 4. Order CRUD Operations
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `PUT /api/orders/{id}` - Update order
- `DELETE /api/orders/{id}` - Delete order

### 5. Health Check
- `GET /api/health` - System health and database connectivity check

## Features Documented

### Request/Response Schemas
All endpoints include:
- Complete request body schemas with required fields
- Response schemas with all properties
- Field types, formats, and constraints
- Example values for all fields

### Authentication Requirements
- Session-based authentication using cookies
- Role-based access control (super_admin, manager, seller)
- Clear documentation of which endpoints require authentication
- Permission requirements for each endpoint

### Error Responses
Standardized error responses for:
- 400 Bad Request - Invalid data
- 401 Unauthorized - Authentication required
- 403 Forbidden - Insufficient permissions
- 404 Not Found - Resource not found
- 500 Internal Server Error - Server errors
- 503 Service Unavailable - Health check failures

### Parameter Descriptions
- Path parameters (e.g., customer ID, product ID)
- Request body parameters with validation rules
- Query parameters where applicable

## Viewing the Documentation

### Option 1: Swagger UI (Recommended)
You can view and interact with the API documentation using Swagger UI:

```bash
# Install swagger-ui-express
npm install swagger-ui-express yamljs

# Add to your server/index.ts:
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./docs/openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

Then visit: http://localhost:5000/api-docs

### Option 2: Swagger Editor
1. Go to https://editor.swagger.io/
2. File → Import File
3. Select `openapi.yaml`

### Option 3: Postman
1. Open Postman
2. Import → Upload Files
3. Select `openapi.yaml`
4. Postman will create a collection with all endpoints

### Option 4: VS Code
Install the "OpenAPI (Swagger) Editor" extension and open the YAML file.

## API Overview

### Base URLs
- Development: `http://localhost:5000`
- Production: `https://api.zippi.crm`

### Authentication
The API uses session-based authentication with HTTP-only cookies:

1. Login via `POST /api/auth/login`
2. Server returns a session cookie (`connect.sid`)
3. Browser automatically sends cookie with subsequent requests
4. Session expires after 24 hours of inactivity

### Multi-tenancy
- Most endpoints are scoped to a tenant
- Users must be associated with a tenant
- Super admins can access all tenants
- Regular users can only access their assigned tenant(s)

### User Roles

| Role | Permissions |
|------|-------------|
| **super_admin** | Full system access, manage all tenants |
| **manager** | Full access within tenant, manage products/users |
| **seller** | Limited access, manage customers/orders |

## Example API Usage

### 1. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt
```

### 2. Get Customers
```bash
curl -X GET http://localhost:5000/api/customers \
  -b cookies.txt
```

### 3. Create Customer
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "phone": "+55 11 98765-4321",
    "segment": "VIP"
  }'
```

### 4. Create Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Wireless Headphones",
    "category": "Electronics",
    "price": 299.99,
    "stock": 45,
    "status": "active"
  }'
```

### 5. Create Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "orderId": "ORD-2024-001",
    "customer": "Maria Silva",
    "customerId": 1,
    "total": 599.98,
    "items": 2,
    "method": "credit_card",
    "status": "completed"
  }'
```

## Data Models

### Customer Segments
- `Novo` - New customer
- `Regular` - Regular customer
- `VIP` - VIP customer
- `Em Risco` - At-risk customer
- `Inativo` - Inactive customer

### Order Status
- `pending` - Order pending
- `processing` - Order being processed
- `completed` - Order completed
- `cancelled` - Order cancelled

### Product Status
- `active` - Product available
- `inactive` - Product unavailable

## Additional Documentation

For database schema documentation, see `DATABASE.md` in this directory.

## Need More Information?

The `openapi.yaml` file contains:
- Detailed field descriptions
- Data type specifications
- Validation rules
- Example values
- Complete request/response structures

Refer to the YAML file for complete technical specifications.
