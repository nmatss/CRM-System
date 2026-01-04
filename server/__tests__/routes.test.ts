import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import bcrypt from 'bcrypt';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

// Mock bcrypt like in auth.test.ts
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock only the database storage methods we need, not the entire module
vi.spyOn(storage, 'healthCheck');
vi.spyOn(storage, 'getUserByCpf');
vi.spyOn(storage, 'getUserByEmail');
vi.spyOn(storage, 'updateUser');
vi.spyOn(storage, 'getUserTenants');
vi.spyOn(storage, 'getCustomers');
vi.spyOn(storage, 'getCustomer');
vi.spyOn(storage, 'createCustomer');
vi.spyOn(storage, 'updateCustomer');
vi.spyOn(storage, 'deleteCustomer');
vi.spyOn(storage, 'getProducts');
vi.spyOn(storage, 'getOrders');

describe('API Routes Integration Tests', () => {
  let app: Express;
  let httpServer: Server;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Set environment variables for tests
    process.env.SESSION_SECRET = 'test-secret-key-for-testing';
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = 'admin@test.com';
    process.env.ADMIN_PASSWORD = 'admin123';

    // Create Express app
    app = express();
    httpServer = createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register routes (this will call setupSession internally)
    await registerRoutes(httpServer, app);

    // Create agent for persistent sessions (cookie jar)
    agent = request.agent(app);
  });

  afterAll(() => {
    if (httpServer) {
      httpServer.close();
    }
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear storage mocks call history
    vi.mocked(storage.healthCheck).mockClear();
    vi.mocked(storage.getUserByCpf).mockClear();
    vi.mocked(storage.getUserByEmail).mockClear();
    vi.mocked(storage.updateUser).mockClear();
    vi.mocked(storage.getUserTenants).mockClear();
    vi.mocked(storage.getCustomers).mockClear();
    vi.mocked(storage.getCustomer).mockClear();
    vi.mocked(storage.createCustomer).mockClear();
    vi.mocked(storage.updateCustomer).mockClear();
    vi.mocked(storage.deleteCustomer).mockClear();
    vi.mocked(storage.getProducts).mockClear();
    vi.mocked(storage.getOrders).mockClear();
    // Note: Don't clear bcrypt mock - it needs its default implementation
  });

  describe('1. Health Check Endpoint', () => {
    it('should return healthy status when database is connected', async () => {
      vi.mocked(storage.healthCheck).mockResolvedValue(true);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
        version: '1.0.0',
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });

    it('should return unhealthy status when database is disconnected', async () => {
      vi.mocked(storage.healthCheck).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        database: 'error',
      });
      expect(response.body.error).toBeDefined();
    });
  });

  describe('2. Login Endpoint - Success Cases', () => {
    it('should successfully login with valid CPF credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        password: '$2b$10$YyLZJZ5zK.EjVGj6YFz1qe.TZQ7Z0vH1Q8oH7T7mQ8Q7Z0vH1Q8oH', // bcrypt hash of "password123"
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(mockUser);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: 'user-123',
          role: 'manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      // Mock bcrypt.compare to return true for valid password
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await agent.post('/api/v1/auth/login').send({
        username: '123.456.789-00',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        isSuperAdmin: false,
        tenantId: 1,
        role: 'manager',
      });
      expect(response.body.message).toBe('Login realizado com sucesso');
      expect(storage.getUserByCpf).toHaveBeenCalledWith('12345678900');
    });

    it('should successfully login with valid email credentials', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'admin@example.com',
        cpf: null,
        name: 'Admin User',
        password: '$2b$10$hashedpassword', // placeholder hash
        isSuperAdmin: true,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      // Mock bcrypt.compare to return true for valid password
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await agent.post('/api/v1/auth/login').send({
        username: 'admin@example.com',
        password: 'admin123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user-456',
        email: 'admin@example.com',
        name: 'Admin User',
        isSuperAdmin: true,
      });
      expect(storage.getUserByEmail).toHaveBeenCalledWith('admin@example.com');
    });
  });

  describe('3. Login Endpoint - Failure Cases', () => {
    it('should reject login with invalid username', async () => {
      vi.mocked(storage.getUserByCpf).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);

      const response = await request(app).post('/api/v1/auth/login').send({
        username: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Usuário ou senha inválidos');
    });

    it('should reject login with invalid password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByEmail).mockResolvedValue(mockUser);
      // Mock bcrypt.compare to return false for wrong password
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const response = await request(app).post('/api/v1/auth/login').send({
        username: 'user@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Usuário ou senha inválidos');
    });

    it('should reject login for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'inactive',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByEmail).mockResolvedValue(mockUser);
      // Mock bcrypt.compare to return true (password is correct, but user is inactive)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await request(app).post('/api/v1/auth/login').send({
        username: 'user@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Usuário inativo. Entre em contato com o administrador.');
    });
  });

  describe('4. Protected Route Access - Without Auth', () => {
    it('should reject access to /api/v1/auth/me without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Não autenticado');
    });

    it('should reject access to /api/v1/customers without authentication', async () => {
      const response = await request(app).get('/api/v1/customers');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Autenticação necessária');
    });

    it('should reject access to /api/v1/dashboard/stats without authentication', async () => {
      const response = await request(app).get('/api/v1/dashboard/stats');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Autenticação necessária');
    });
  });

  describe('5. Protected Route Access - With Auth', () => {
    beforeEach(async () => {
      // Login to establish session
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(mockUser);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: 'user-123',
          role: 'manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post('/api/v1/auth/login').send({
        username: '123.456.789-00',
        password: 'password123',
      });
      // Note: Don't clear mocks here as it would break the session
    });

    it('should allow access to /api/v1/auth/me with authentication', async () => {
      const response = await agent.get('/api/v1/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      });
    });

    it('should allow access to /api/v1/customers with authentication', async () => {
      vi.mocked(storage.getCustomers).mockResolvedValue({
        data: [
          {
            id: 1,
            tenantId: 1,
            name: 'Customer 1',
            email: 'customer1@example.com',
            phone: '11999999999',
            segment: 'VIP',
            ltv: 'R$ 1.000,00',
            lastPurchase: '2024-01-01',
            favoriteCategory: 'Electronics',
            birthDate: null,
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await agent.get('/api/v1/customers');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Customer 1');
    });
  });

  describe('6. Customer CRUD - Create', () => {
    beforeEach(async () => {
      // Login as manager
      const mockUser = {
        id: 'manager-123',
        email: 'manager@example.com',
        cpf: '12345678900',
        name: 'Manager User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(mockUser);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: 'manager-123',
          role: 'manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post('/api/v1/auth/login').send({
        username: '123.456.789-00',
        password: 'password123',
      });

      // Note: Don't clear mocks here as it would break the session
    });

    it('should create a new customer', async () => {
      const newCustomer = {
        id: 2,
        tenantId: 1,
        name: 'New Customer',
        email: 'newcustomer@example.com',
        phone: '11988888888',
        segment: 'Novo',
        ltv: 0,
        lastPurchase: null,
        favoriteCategory: null,
        birthDate: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(storage.createCustomer).mockResolvedValue(newCustomer);

      const response = await agent.post('/api/v1/customers').send({
        name: 'New Customer',
        email: 'newcustomer@example.com',
        phone: '11988888888',
        segment: 'Novo',
        ltv: 0,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 2,
        name: 'New Customer',
        email: 'newcustomer@example.com',
      });
      expect(storage.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          name: 'New Customer',
          email: 'newcustomer@example.com',
        })
      );
    });
  });

  describe('7. Customer CRUD - Update and Delete', () => {
    beforeEach(async () => {
      // Login as manager
      const mockUser = {
        id: 'manager-123',
        email: 'manager@example.com',
        cpf: '12345678900',
        name: 'Manager User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(mockUser);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: 'manager-123',
          role: 'manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post('/api/v1/auth/login').send({
        username: '123.456.789-00',
        password: 'password123',
      });

      // Note: Don't clear mocks here as it would break the session
    });

    it('should update an existing customer', async () => {
      const updatedCustomer = {
        id: 1,
        tenantId: 1,
        name: 'Updated Customer',
        email: 'updated@example.com',
        phone: '11977777777',
        segment: 'VIP',
        ltv: 'R$ 2.000,00',
        lastPurchase: '2024-01-15',
        favoriteCategory: 'Electronics',
        birthDate: null,
        createdAt: new Date(),
      };

      vi.mocked(storage.updateCustomer).mockResolvedValue(updatedCustomer);

      const response = await agent.put('/api/v1/customers/1').send({
        name: 'Updated Customer',
        email: 'updated@example.com',
        phone: '11977777777',
        segment: 'VIP',
        ltv: 'R$ 2.000,00',
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Updated Customer',
        email: 'updated@example.com',
      });
      expect(storage.updateCustomer).toHaveBeenCalledWith(1, 1, expect.any(Object));
    });

    it('should return 404 when updating non-existent customer', async () => {
      vi.mocked(storage.updateCustomer).mockResolvedValue(undefined);

      const response = await agent.put('/api/v1/customers/999').send({
        name: 'Non-existent Customer',
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cliente não encontrado');
    });

    it('should delete an existing customer', async () => {
      vi.mocked(storage.deleteCustomer).mockResolvedValue(true);

      const response = await agent.delete('/api/v1/customers/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Cliente excluído com sucesso');
      expect(storage.deleteCustomer).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 when deleting non-existent customer', async () => {
      vi.mocked(storage.deleteCustomer).mockResolvedValue(false);

      const response = await agent.delete('/api/v1/customers/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cliente não encontrado');
    });
  });

  describe('8. Logout Endpoint', () => {
    beforeEach(async () => {
      // Login first
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        cpf: '12345678900',
        name: 'Test User',
        password: '$2b$10$hashedpassword',
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(mockUser);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: 'user-123',
          role: 'manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post('/api/v1/auth/login').send({
        username: '123.456.789-00',
        password: 'password123',
      });

      // Note: Don't clear mocks here as it would break the session
    });

    it('should successfully logout', async () => {
      const response = await agent.post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout realizado com sucesso');
    });

    it('should not have access to protected routes after logout', async () => {
      await agent.post('/api/v1/auth/logout');

      const response = await agent.get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Não autenticado');
    });
  });
});
