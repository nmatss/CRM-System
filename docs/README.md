# ZippiCRM Documentation

Welcome to the ZippiCRM documentation directory. This folder contains comprehensive documentation for the ZippiCRM API and database schema.

## Documentation Files

### API Documentation

1. **[openapi.yaml](./openapi.yaml)** (1,086 lines)
   - Complete OpenAPI 3.0 specification
   - All API endpoints with detailed schemas
   - Request/response examples
   - Authentication and authorization details
   - Error response documentation
   - **Use this for**: API integration, Swagger UI, Postman imports

2. **[API_README.md](./API_README.md)** (224 lines)
   - Comprehensive API guide
   - How to view the documentation
   - Example API usage with curl
   - Authentication flow
   - Multi-tenancy explanation
   - **Use this for**: Getting started with the API

3. **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** (222 lines)
   - Quick lookup for all endpoints
   - Request/response examples
   - Common error codes
   - Role permissions table
   - Data enums reference
   - **Use this for**: Quick reference during development

### Database Documentation

4. **[DATABASE.md](./DATABASE.md)** (532 lines)
   - Complete database schema
   - All tables and relationships
   - Field descriptions
   - Indexes and constraints
   - **Use this for**: Understanding the data model

## Quick Start

### For API Consumers

1. Start with **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** for a quick overview
2. Read **[API_README.md](./API_README.md)** for detailed usage instructions
3. Import **[openapi.yaml](./openapi.yaml)** into Swagger UI or Postman for interactive testing

### For Developers

1. Review **[DATABASE.md](./DATABASE.md)** to understand the data model
2. Study **[openapi.yaml](./openapi.yaml)** for complete API specifications
3. Use **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** as a daily reference

### For Frontend Developers

1. Check **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** for available endpoints
2. Use **[openapi.yaml](./openapi.yaml)** to generate TypeScript types
3. Refer to **[API_README.md](./API_README.md)** for authentication flow

## API Overview

The ZippiCRM API is a RESTful API with the following characteristics:

- **Authentication**: Session-based with HTTP-only cookies
- **Authorization**: Role-based (super_admin, manager, seller)
- **Multi-tenancy**: All data is scoped to tenants
- **Format**: JSON request/response bodies
- **Base URL**: `http://localhost:5000` (development)

## Main API Sections

### 1. Authentication (`/api/auth/*`)
User login, logout, registration, and session management.

### 2. Customers (`/api/customers`)
Complete CRUD operations for customer management.

### 3. Products (`/api/products`)
Product catalog management (manager role required for modifications).

### 4. Orders (`/api/orders`)
Order processing and tracking.

### 5. Health Check (`/api/health`)
System status and database connectivity.

## Using the OpenAPI Specification

### With Swagger UI

```bash
# Install dependencies
npm install swagger-ui-express yamljs

# Add to your server
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./docs/openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

Visit: http://localhost:5000/api-docs

### With Postman

1. Open Postman
2. Import → Upload Files
3. Select `openapi.yaml`
4. Use the generated collection

### With Online Tools

- **Swagger Editor**: https://editor.swagger.io/
- **Swagger UI**: https://petstore.swagger.io/
- **ReDoc**: https://redocly.github.io/redoc/

## Authentication Flow

```
1. POST /api/auth/login
   → Returns session cookie (connect.sid)

2. Subsequent requests include cookie automatically
   → Server validates session

3. POST /api/auth/logout (when done)
   → Destroys session
```

## Role Permissions Summary

| Endpoint | Super Admin | Manager | Seller |
|----------|-------------|---------|--------|
| Health Check | ✓ | ✓ | ✓ |
| Authentication | ✓ | ✓ | ✓ |
| Customers (Read) | ✓ | ✓ | ✓ |
| Customers (Write) | ✓ | ✓ | ✓ |
| Products (Read) | ✓ | ✓ | ✓ |
| Products (Write) | ✓ | ✓ | ✗ |
| Orders (Read) | ✓ | ✓ | ✓ |
| Orders (Write) | ✓ | ✓ | ✓ |

## Example: Basic API Usage

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"pass123"}' \
  -c cookies.txt

# 2. Get customers
curl http://localhost:5000/api/customers \
  -b cookies.txt

# 3. Create customer
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "segment": "VIP"
  }'

# 4. Logout
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

## Data Models

### Core Entities

- **Tenants**: Multi-tenant organizations
- **Users**: System users with roles
- **Customers**: End customers/clients
- **Products**: Product catalog items
- **Orders**: Purchase orders

### Supporting Entities

- Campaigns
- Automations
- Cashback Rules
- Seller Tasks
- Customer Interactions

For complete schema details, see [DATABASE.md](./DATABASE.md).

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message in Portuguese"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## Contributing

When updating the API:

1. Update `openapi.yaml` with new endpoints
2. Add examples to `API_README.md`
3. Update `API_QUICK_REFERENCE.md` with the endpoint summary
4. Update `DATABASE.md` if schema changes

## Support

For questions or issues:
- Email: admin@zippi.crm
- Review the relevant documentation file
- Check the OpenAPI specification for details

---

**Last Updated**: December 15, 2024
**API Version**: 1.0.0
**Documentation Version**: 1.0.0
