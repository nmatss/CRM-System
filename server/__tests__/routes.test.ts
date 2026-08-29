import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import session from "express-session";
import { registerLimiter } from "../rateLimit";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";

let registerRoutes: (typeof import("../routes"))["registerRoutes"];
let storage: (typeof import("../storage"))["storage"];

// Mock bcrypt like in auth.test.ts
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

function setupStorageSpies() {
  vi.spyOn(storage, "healthCheck");
  vi.spyOn(storage, "deepHealthCheck");
  vi.spyOn(storage, "getUser");
  vi.spyOn(storage, "getUserByCpf");
  vi.spyOn(storage, "getUserByEmail");
  vi.spyOn(storage, "createUser");
  vi.spyOn(storage, "registerSelfService");
  vi.spyOn(storage, "createUserWithMembership");
  vi.spyOn(storage, "getTenant");
  vi.spyOn(storage, "getTenantUser");
  vi.spyOn(storage, "getTenants");
  vi.spyOn(storage, "updateUser");
  vi.spyOn(storage, "updateUserBySuperAdmin");
  vi.spyOn(storage, "updateUserPassword");
  vi.spyOn(storage, "updateUserPasswordAudited");
  vi.spyOn(storage, "getUserTenants");
  vi.spyOn(storage, "getCustomers");
  vi.spyOn(storage, "getCustomer");
  vi.spyOn(storage, "createCustomer");
  vi.spyOn(storage, "updateCustomer");
  vi.spyOn(storage, "deleteCustomer");
  vi.spyOn(storage, "getProducts");
  vi.spyOn(storage, "getOrders");
  vi.spyOn(storage, "getProduct");
  vi.spyOn(storage, "getOrder");
  vi.spyOn(storage, "createOrder");
  vi.spyOn(storage, "createOrderWithLineItems");
  vi.spyOn(storage, "getOrderItems");
  vi.spyOn(storage, "cancelOrder");
  vi.spyOn(storage, "deleteOrder");
  vi.spyOn(storage, "updateProduct");
  vi.spyOn(storage, "updateOrder");
  vi.spyOn(storage, "getAutomation");
  vi.spyOn(storage, "updateAutomation");
  vi.spyOn(storage, "getSellerTask");
  vi.spyOn(storage, "createSellerTask");
  vi.spyOn(storage, "getSellerGoals");
  vi.spyOn(storage, "upsertSellerGoals");
  vi.spyOn(storage, "getCustomerInteractions");
  vi.spyOn(storage, "createCustomerInteraction");
  vi.spyOn(storage, "updateTenantUserRole");
  vi.spyOn(storage, "upsertTenantUserAudited");
  vi.spyOn(storage, "deleteTenantUserAudited");
  vi.spyOn(storage, "appendAuditEvent");
  vi.spyOn(storage, "getAuditEvents");
  vi.spyOn(storage, "getSalesReport");
  vi.spyOn(storage, "getDashboardStats");
  vi.spyOn(storage, "getDashboardCharts");
  vi.spyOn(storage, "getCustomerOrderHistory");
  vi.spyOn(storage, "getNotifications");
  vi.spyOn(storage, "getCashbackTransactions");
  vi.spyOn(storage, "creditCashback");
  vi.spyOn(storage, "debitCashback");
  vi.spyOn(storage, "reverseCashback");
  vi.spyOn(storage, "expireCashback");
  vi.spyOn(storage, "reconcileCashback");
}

describe("API Routes Integration Tests", () => {
  let app: Express;
  let httpServer: Server;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  async function refreshCsrfToken() {
    const response = await agent.get("/api/v1/csrf-token");
    csrfToken = response.body.csrfToken;
  }

  beforeAll(async () => {
    // Set environment variables for tests
    process.env.SESSION_SECRET = "test-secret-key-for-testing";
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.ADMIN_PASSWORD = "admin123";
    process.env.DATABASE_PATH = "./data/test-routes.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-routes-sessions.db";

    ({ storage } = await import("../storage"));
    setupStorageSpies();
    vi.mocked(storage.getUserByEmail).mockResolvedValue({
      id: "admin-test",
      email: "admin@test.com",
      cpf: null,
      sellerCode: null,
      password: "$2b$10$hashedpassword",
      name: "Admin Test",
      phone: null,
      isSuperAdmin: true,
      mustChangePassword: false,
      emailVerified: true,
      status: "active",
      lastPasswordChange: null,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(storage.getTenants).mockResolvedValue([]);
    ({ registerRoutes } = await import("../routes"));

    // Create Express app
    app = express();
    httpServer = createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register routes (this will call setupSession internally)
    await registerRoutes(httpServer, app);
    vi.mocked(storage.getUserByEmail).mockReset();
    vi.mocked(storage.getTenants).mockReset();

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
    vi.mocked(storage.deepHealthCheck).mockClear();
    vi.mocked(storage.getUser).mockClear();
    vi.mocked(storage.getUserByCpf).mockReset();
    vi.mocked(storage.getUserByEmail).mockReset();
    vi.mocked(storage.createUser).mockClear();
    vi.mocked(storage.registerSelfService).mockClear();
    vi.mocked(storage.createUserWithMembership).mockClear();
    vi.mocked(storage.getTenant).mockClear();
    vi.mocked(storage.getTenantUser).mockClear();
    vi.mocked(storage.getTenants).mockClear();
    vi.mocked(storage.updateUser).mockClear();
    vi.mocked(storage.updateUserBySuperAdmin).mockClear();
    vi.mocked(storage.updateUserPassword).mockClear();
    vi.mocked(storage.updateUserPasswordAudited).mockClear();
    vi.mocked(storage.getUserTenants).mockClear();
    vi.mocked(storage.getCustomers).mockClear();
    vi.mocked(storage.getCustomer).mockClear();
    vi.mocked(storage.getDashboardStats).mockClear();
    vi.mocked(storage.getDashboardCharts).mockClear();
    vi.mocked(storage.getCustomerOrderHistory).mockClear();
    vi.mocked(storage.createCustomer).mockClear();
    vi.mocked(storage.updateCustomer).mockClear();
    vi.mocked(storage.deleteCustomer).mockClear();
    vi.mocked(storage.getProducts).mockClear();
    vi.mocked(storage.getOrders).mockClear();
    vi.mocked(storage.getProduct).mockClear();
    vi.mocked(storage.getOrder).mockClear();
    vi.mocked(storage.createOrder).mockClear();
    vi.mocked(storage.createOrderWithLineItems).mockClear();
    vi.mocked(storage.getOrderItems).mockClear();
    vi.mocked(storage.cancelOrder).mockClear();
    vi.mocked(storage.deleteOrder).mockClear();
    vi.mocked(storage.updateProduct).mockClear();
    vi.mocked(storage.updateOrder).mockClear();
    vi.mocked(storage.getAutomation).mockClear();
    vi.mocked(storage.updateAutomation).mockClear();
    vi.mocked(storage.getSellerTask).mockClear();
    vi.mocked(storage.createSellerTask).mockClear();
    vi.mocked(storage.getSellerGoals).mockClear();
    vi.mocked(storage.upsertSellerGoals).mockClear();
    vi.mocked(storage.getCustomerInteractions).mockClear();
    vi.mocked(storage.createCustomerInteraction).mockClear();
    vi.mocked(storage.updateTenantUserRole).mockClear();
    vi.mocked(storage.upsertTenantUserAudited).mockClear();
    vi.mocked(storage.deleteTenantUserAudited).mockClear();
    vi.mocked(storage.appendAuditEvent).mockReset();
    vi.mocked(storage.getAuditEvents).mockReset();
    vi.mocked(storage.getSalesReport).mockReset();
    vi.mocked(storage.appendAuditEvent).mockResolvedValue({
      id: 1,
      tenantId: null,
      actorUserId: null,
      action: "auth.login",
      targetType: "user",
      targetId: null,
      outcome: "success",
      requestId: "test-request",
      createdAt: new Date().toISOString(),
      metadata: {},
    });
    vi.mocked(storage.getAuditEvents).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(storage.getNotifications).mockClear();
    vi.mocked(storage.getCashbackTransactions).mockClear();
    vi.mocked(storage.creditCashback).mockClear();
    vi.mocked(storage.debitCashback).mockClear();
    vi.mocked(storage.reverseCashback).mockClear();
    vi.mocked(storage.expireCashback).mockClear();
    vi.mocked(storage.reconcileCashback).mockClear();
    vi.mocked(storage.getUser).mockImplementation(async (id: string) => ({
      id,
      email: `${id}@example.com`,
      cpf: "12345678900",
      name: "Test User",
      password: "$2b$10$hashedpassword",
      isSuperAdmin: false,
      status: "active",
      mustChangePassword: false,
      sellerCode: null,
      phone: null,
      emailVerified: true,
      lastPasswordChange: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    vi.mocked(storage.getTenant).mockResolvedValue({
      id: 1,
      name: "Tenant Test",
      slug: "tenant-test",
      plan: "free",
      status: "active",
      logo: null,
      primaryColor: "#9333ea",
      secondaryColor: "#db2777",
      loginMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(storage.getTenantUser).mockImplementation(
      async (tenantId: number, userId: string) => ({
        id: 1,
        tenantId,
        userId,
        role: "manager",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    // Note: Don't clear bcrypt mock - it needs its default implementation
  });

  describe("1. Health Check Endpoint", () => {
    it("should return a cheap liveness response without querying storage", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        version: "1.0.0",
      });
      expect(response.body.timestamp).toBeDefined();
      expect(storage.healthCheck).not.toHaveBeenCalled();
    });

    it("should expose cheap database readiness separately", async () => {
      vi.mocked(storage.healthCheck).mockResolvedValue(false);

      const response = await request(app).get("/api/ready");

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: "not_ready",
        database: "disconnected",
      });
    });

    it("answers an unknown API path with JSON 404 instead of the SPA fallback", async () => {
      const response = await request(app).get("/api/v1/rota-inexistente");

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: "ROUTE_NOT_FOUND" });
      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("2. Login Endpoint - Success Cases", () => {
    it("should successfully login with valid CPF credentials", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        password: "$2b$10$YyLZJZ5zK.EjVGj6YFz1qe.TZQ7Z0vH1Q8oH7T7mQ8Q7Z0vH1Q8oH", // bcrypt hash of "password123"
        isSuperAdmin: false,
        status: "active",
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
          userId: "user-123",
          role: "manager",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      // Mock bcrypt.compare to return true for valid password
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await agent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        isSuperAdmin: false,
        tenantId: 1,
        role: "manager",
      });
      expect(response.body.message).toBe("Login realizado com sucesso");
      expect(storage.getUserByCpf).toHaveBeenCalledWith("12345678900");
    });

    it("should successfully login with valid email credentials", async () => {
      const mockUser = {
        id: "user-456",
        email: "admin@example.com",
        cpf: null,
        name: "Admin User",
        password: "$2b$10$hashedpassword", // placeholder hash
        isSuperAdmin: true,
        status: "active",
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

      const response = await agent.post("/api/v1/auth/login").send({
        username: "  ADMIN@Example.COM  ",
        password: "admin123",
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: "user-456",
        email: "admin@example.com",
        name: "Admin User",
        isSuperAdmin: true,
      });
      expect(storage.getUserByEmail).toHaveBeenCalledWith("admin@example.com");
    });

    it("keeps a durably audited login successful when lastLogin metadata update fails", async () => {
      const isolatedAgent = request.agent(app);
      const user = {
        id: "last-login-failure",
        email: "last-login@example.com",
        cpf: "22233344455",
        name: "Last Login",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: true,
        status: "active",
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        emailVerified: true,
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(storage.getUserByCpf).mockResolvedValue(user);
      vi.mocked(storage.updateUser).mockRejectedValueOnce(new Error("metadata write failed"));
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await isolatedAgent.post("/api/v1/auth/login").send({
        username: user.cpf,
        password: "password123",
      });
      expect(response.status).toBe(200);
      expect(storage.appendAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: user.id,
          outcome: "success",
          action: "auth.login",
        }),
      );
      expect((await isolatedAgent.get("/api/v1/auth/me")).status).toBe(200);
    });

    it("normalizes public registration email and requires a 12-character password", async () => {
      const weakResponse = await request(app).post("/api/v1/auth/register").send({
        email: "USER@Example.COM",
        password: "short-pass",
        name: "Test User",
      });
      expect(weakResponse.status).toBe(400);
      expect(weakResponse.body.code).toBe("VALIDATION_ERROR");
      expect(storage.createUser).not.toHaveBeenCalled();

      const registeredUser = {
        id: "registered-user",
        email: "user@example.com",
        cpf: null,
        sellerCode: null,
        password: "$2b$10$hashedpassword",
        name: "Test User",
        phone: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        emailVerified: false,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(storage.registerSelfService).mockResolvedValue({ user: registeredUser });

      const response = await request(app).post("/api/v1/auth/register").send({
        email: "  USER@Example.COM  ",
        password: "long-password",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(storage.getUserByEmail).toHaveBeenCalledWith("user@example.com");
      expect(storage.registerSelfService).toHaveBeenCalledWith(
        expect.objectContaining({ email: "user@example.com" }),
        undefined,
        expect.objectContaining({ action: "auth.register" }),
      );
    });

    it("reports account-created/session-unavailable and makes retry hit normalized uniqueness", async () => {
      const registeredUser = {
        id: "registered-session-failure",
        email: "session-failure@example.com",
        cpf: null,
        sellerCode: null,
        password: "$2b$10$hashedpassword",
        name: "Session Failure",
        phone: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        emailVerified: false,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.getUserByEmail)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(registeredUser);
      vi.mocked(storage.registerSelfService).mockResolvedValue({ user: registeredUser });
      const save = vi
        .spyOn(session.Session.prototype, "save")
        .mockImplementationOnce(function (callback) {
          callback?.(new Error("session store unavailable"));
          return this;
        });

      const first = await request(app).post("/api/v1/auth/register").send({
        email: " Session-Failure@Example.com ",
        password: "long-password",
        name: "Session Failure",
      });
      save.mockRestore();
      expect(first.status).toBe(503);
      expect(first.body.code).toBe("ACCOUNT_CREATED_SESSION_UNAVAILABLE");

      registerLimiter.resetKey("::/56");
      registerLimiter.resetKey("::ffff:127.0.0.1");
      registerLimiter.resetKey("127.0.0.1");

      const retry = await request(app).post("/api/v1/auth/register").send({
        email: "session-failure@example.com",
        password: "long-password",
        name: "Session Failure",
      });
      expect(retry.status).toBe(400);
      expect(retry.body.code).toBe("DUPLICATE_EMAIL");
      expect(storage.registerSelfService).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Login Endpoint - Failure Cases", () => {
    it("should reject login with invalid username", async () => {
      vi.mocked(storage.getUserByCpf).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);

      const response = await request(app).post("/api/v1/auth/login").send({
        username: "nonexistent@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Usuário ou senha inválidos");
      expect(storage.appendAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.login",
          outcome: "failure",
          metadata: { identifierType: "email", reason: "invalid_credentials" },
        }),
      );
      expect(JSON.stringify(vi.mocked(storage.appendAuditEvent).mock.calls)).not.toContain(
        "nonexistent@example.com",
      );
    });

    it("should reject login with invalid password", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "active",
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

      const response = await request(app).post("/api/v1/auth/login").send({
        username: "user@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Usuário ou senha inválidos");
    });

    it("should reject login for inactive user", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "inactive",
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

      const response = await request(app).post("/api/v1/auth/login").send({
        username: "user@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Usuário inativo. Entre em contato com o administrador.");
    });

    it("invalidates the new session when durable success audit is unavailable", async () => {
      const isolatedAgent = request.agent(app);
      vi.mocked(storage.getUserByCpf).mockResolvedValue({
        id: "audit-failure-user",
        email: "audit@example.com",
        cpf: "12345678900",
        name: "Audit User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: true,
        status: "active",
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        emailVerified: true,
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(storage.appendAuditEvent).mockRejectedValueOnce(new Error("audit unavailable"));

      const login = await isolatedAgent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      expect(login.status).toBe(503);
      expect(login.body.code).toBe("AUDIT_UNAVAILABLE");
      expect((await isolatedAgent.get("/api/v1/auth/me")).status).toBe(401);
      expect(storage.updateUser).not.toHaveBeenCalledWith(
        "audit-failure-user",
        expect.objectContaining({ lastLogin: expect.anything() }),
      );
    });

    it("does not record login success when saving the session fails", async () => {
      vi.mocked(storage.getUserByCpf).mockResolvedValue({
        id: "save-failure-user",
        email: "save@example.com",
        cpf: "12345678900",
        name: "Save User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: true,
        status: "active",
        mustChangePassword: false,
        sellerCode: null,
        phone: null,
        emailVerified: true,
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const save = vi
        .spyOn(session.Session.prototype, "save")
        .mockImplementationOnce(function (callback) {
          callback?.(new Error("session store unavailable"));
          return this;
        });

      const response = await request(app).post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      save.mockRestore();

      expect(response.status).toBe(400);
      expect(storage.appendAuditEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "success" }),
      );
      expect(storage.updateUser).not.toHaveBeenCalledWith(
        "save-failure-user",
        expect.objectContaining({ lastLogin: expect.anything() }),
      );
    });
  });

  describe("4. Protected Route Access - Without Auth", () => {
    it("should reject access to /api/v1/auth/me without authentication", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Autenticação necessária");
    });

    it("should reject access to /api/v1/customers without authentication", async () => {
      const response = await request(app).get("/api/v1/customers");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Autenticação necessária");
    });

    it("should reject CSRF token requests without authentication", async () => {
      const response = await request(app).get("/api/v1/csrf-token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Autenticação necessária");
    });

    it("should reject access to /api/v1/dashboard/stats without authentication", async () => {
      const response = await request(app).get("/api/v1/dashboard/stats");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Autenticação necessária");
    });
  });

  describe("5. Protected Route Access - With Auth", () => {
    beforeEach(async () => {
      // Login to establish session
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "active",
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
          userId: "user-123",
          role: "manager",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      await refreshCsrfToken();
      // Note: Don't clear mocks here as it would break the session
    });

    it("should allow access to /api/v1/auth/me with authentication", async () => {
      const response = await agent.get("/api/v1/auth/me");

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: "user-123",
        email: "user-123@example.com",
        name: "Test User",
      });
    });

    it("should allow access to /api/v1/customers with authentication", async () => {
      vi.mocked(storage.getCustomers).mockResolvedValue({
        data: [
          {
            id: 1,
            tenantId: 1,
            name: "Customer 1",
            email: "customer1@example.com",
            phone: "11999999999",
            segment: "VIP",
            ltv: "R$ 1.000,00",
            lastPurchase: "2024-01-01",
            favoriteCategory: "Electronics",
            birthDate: null,
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await agent.get("/api/v1/customers");

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe("Customer 1");
    });

    it("composes the dashboard contract from uncapped integer-money services", async () => {
      vi.mocked(storage.getDashboardStats).mockResolvedValue({
        totalCustomers: 2,
        totalRevenue: 19.99,
        totalRevenueCents: 1999,
        totalOrders: 1,
        averageTicket: 19.99,
        averageTicketCents: 1999,
        vipCustomers: 1,
        totalProducts: 1,
        weeklyData: [],
        recentOrders: [],
        revenueGrowth: 0,
        newCustomers: 1,
        activeCustomers: 0,
      });
      vi.mocked(storage.getDashboardCharts).mockResolvedValue({
        revenueByMonth: [{ month: "Ago/26", revenue: 19.99, revenueCents: 1999 }],
        ordersByStatus: [{ status: "Pago", count: 1 }],
        customersBySegment: [{ segment: "VIP", count: 1 }],
        topProducts: [{ name: "Product", revenue: 19.99, quantity: 1 }],
      });

      const response = await agent.get("/api/v1/dashboard/stats");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalRevenueCents: 1999,
        salesChart: [{ date: "Ago/26", value: 19.99, valueCents: 1999 }],
        customerSegments: [{ name: "VIP", value: 1, color: "#9333ea" }],
        topProducts: [{ name: "Product", sales: 1, revenue: 19.99 }],
      });
      expect(storage.getDashboardStats).toHaveBeenCalledWith(1);
      expect(storage.getDashboardCharts).toHaveBeenCalledWith(1);
    });
  });

  describe("6. Customer CRUD - Create", () => {
    beforeEach(async () => {
      // Login as manager
      const mockUser = {
        id: "manager-123",
        email: "manager@example.com",
        cpf: "12345678900",
        name: "Manager User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "active",
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
          userId: "manager-123",
          role: "manager",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      await refreshCsrfToken();

      // Note: Don't clear mocks here as it would break the session
    });

    it("should reject authenticated state changes without CSRF token", async () => {
      const response = await agent.post("/api/v1/customers").send({
        name: "New Customer",
        email: "newcustomer@example.com",
        phone: "11988888888",
        segment: "Novo",
        ltv: 0,
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("CSRF token missing");
    });

    it("should create a new customer", async () => {
      const newCustomer = {
        id: 2,
        tenantId: 1,
        name: "New Customer",
        email: "newcustomer@example.com",
        phone: "11988888888",
        segment: "Novo",
        ltv: 0,
        lastPurchase: null,
        favoriteCategory: null,
        birthDate: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(storage.createCustomer).mockResolvedValue(newCustomer);

      const response = await agent.post("/api/v1/customers").set("X-CSRF-Token", csrfToken).send({
        name: "New Customer",
        email: "newcustomer@example.com",
        phone: "11988888888",
        segment: "Novo",
        ltv: 0,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 2,
        name: "New Customer",
        email: "newcustomer@example.com",
      });
      expect(storage.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          name: "New Customer",
          email: "newcustomer@example.com",
        }),
      );
    });
  });

  describe("7. Customer CRUD - Update and Delete", () => {
    beforeEach(async () => {
      // Login as manager
      const mockUser = {
        id: "manager-123",
        email: "manager@example.com",
        cpf: "12345678900",
        name: "Manager User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "active",
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
          userId: "manager-123",
          role: "manager",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      await refreshCsrfToken();

      // Note: Don't clear mocks here as it would break the session
    });

    it("should update an existing customer", async () => {
      const updatedCustomer = {
        id: 1,
        tenantId: 1,
        name: "Updated Customer",
        email: "updated@example.com",
        phone: "11977777777",
        segment: "VIP",
        ltv: "R$ 2.000,00",
        lastPurchase: "2024-01-15",
        favoriteCategory: "Electronics",
        birthDate: null,
        createdAt: new Date(),
      };

      vi.mocked(storage.updateCustomer).mockResolvedValue(updatedCustomer);

      const response = await agent.put("/api/v1/customers/1").set("X-CSRF-Token", csrfToken).send({
        name: "Updated Customer",
        email: "updated@example.com",
        phone: "11977777777",
        segment: "VIP",
        ltv: "R$ 2.000,00",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: "Updated Customer",
        email: "updated@example.com",
      });
      expect(storage.updateCustomer).toHaveBeenCalledWith(1, 1, expect.any(Object));
    });

    it("should return 404 when updating non-existent customer", async () => {
      vi.mocked(storage.updateCustomer).mockResolvedValue(undefined);

      const response = await agent
        .put("/api/v1/customers/999")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Non-existent Customer",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Cliente não encontrado");
    });

    it("should delete an existing customer", async () => {
      vi.mocked(storage.deleteCustomer).mockResolvedValue(true);

      const response = await agent.delete("/api/v1/customers/1").set("X-CSRF-Token", csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cliente excluído com sucesso");
      expect(storage.deleteCustomer).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({
          action: "entity.deleted",
          tenantId: 1,
        }),
      );
    });

    it("should return 404 when deleting non-existent customer", async () => {
      vi.mocked(storage.deleteCustomer).mockResolvedValue(false);

      const response = await agent.delete("/api/v1/customers/999").set("X-CSRF-Token", csrfToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Cliente não encontrado");
    });
  });

  describe("8. Logout Endpoint", () => {
    beforeEach(async () => {
      // Login first
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        cpf: "12345678900",
        name: "Test User",
        password: "$2b$10$hashedpassword",
        isSuperAdmin: false,
        status: "active",
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
          userId: "user-123",
          role: "manager",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.mocked(storage.upsertTenantUserAudited).mockResolvedValue({
        id: 10,
        tenantId: 1,
        userId: "shared-user",
        role: "manager",
        isActive: true,
        createdAt: null,
        updatedAt: null,
      });
      vi.mocked(storage.updateUser).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await agent.post("/api/v1/auth/login").send({
        username: "123.456.789-00",
        password: "password123",
      });
      await refreshCsrfToken();

      // Note: Don't clear mocks here as it would break the session
    });

    it("should successfully logout", async () => {
      const response = await agent.post("/api/v1/auth/logout").set("X-CSRF-Token", csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logout realizado com sucesso");
    });

    it("should not have access to protected routes after logout", async () => {
      await agent.post("/api/v1/auth/logout").set("X-CSRF-Token", csrfToken);

      const response = await agent.get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Autenticação necessária");
    });
  });

  describe("P0 tenant security regressions", () => {
    async function loginAsManager(securityAgent: request.SuperAgentTest) {
      const manager = {
        id: "manager-p0",
        email: "manager-p0@example.com",
        cpf: "12345678900",
        sellerCode: null,
        password: "$2b$10$hashedpassword",
        name: "Manager P0",
        phone: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        emailVerified: true,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(storage.getUserByCpf).mockResolvedValue(manager);
      vi.mocked(storage.getUserTenants).mockImplementation(async (userId: string) =>
        userId === manager.id
          ? [
              {
                id: 1,
                tenantId: 1,
                userId: manager.id,
                role: "manager",
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]
          : [],
      );
      vi.mocked(storage.updateUser).mockResolvedValue(manager);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const loginResponse = await securityAgent.post("/api/v1/auth/login").send({
        username: manager.cpf,
        password: "password123",
      });
      expect(loginResponse.status).toBe(200);

      const tokenResponse = await securityAgent.get("/api/v1/csrf-token");
      expect(tokenResponse.status).toBe(200);
      return tokenResponse.body.csrfToken as string;
    }

    it("blocks a tenant manager from resetting a user shared with another tenant", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);

      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 10,
          tenantId: 1,
          userId: "shared-user",
          role: "seller",
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
        {
          id: 11,
          tenantId: 2,
          userId: "shared-user",
          role: "seller",
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
      ]);

      const response = await securityAgent
        .post("/api/v1/team/shared-user/reset-password")
        .set("X-CSRF-Token", csrfToken)
        .send({ newPassword: "temporary-password-123" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CROSS_TENANT_PASSWORD_RESET_FORBIDDEN");
      expect(storage.updateUserPassword).not.toHaveBeenCalled();
    });

    it("allows tenant role updates but blocks global identity fields", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);
      vi.mocked(storage.updateTenantUserRole).mockResolvedValue({
        id: 2,
        tenantId: 1,
        userId: "shared-user",
        role: "manager",
        isActive: true,
        createdAt: null,
        updatedAt: null,
      });

      const forbiddenResponse = await securityAgent
        .put("/api/v1/team/shared-user")
        .set("X-CSRF-Token", csrfToken)
        .send({ name: "Cross Tenant Rename", phone: "11999999999" });
      expect(forbiddenResponse.status).toBe(400);
      expect(forbiddenResponse.body.code).toBe("GLOBAL_IDENTITY_FIELDS_FORBIDDEN");
      expect(storage.updateUser).not.toHaveBeenCalledWith("shared-user", expect.anything());

      const roleResponse = await securityAgent
        .put("/api/v1/team/shared-user")
        .set("X-CSRF-Token", csrfToken)
        .send({ role: "manager" });
      expect(roleResponse.status).toBe(200);
      expect(storage.upsertTenantUserAudited).toHaveBeenCalledWith(
        1,
        "shared-user",
        "manager",
        expect.objectContaining({ action: "membership.role_changed" }),
      );
    });

    it("enforces positive capped limits on bounded tenant feeds", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);
      vi.mocked(storage.getCustomerInteractions).mockResolvedValue([]);
      vi.mocked(storage.getNotifications).mockResolvedValue([]);
      vi.mocked(storage.getCashbackTransactions).mockResolvedValue([]);

      for (const endpoint of [
        "/api/v1/customer-interactions",
        "/api/v1/notifications",
        "/api/v1/cashback/transactions",
      ]) {
        for (const invalidLimit of ["0", "-1", "101", "1.5"]) {
          const response = await securityAgent.get(`${endpoint}?limit=${invalidLimit}`);
          expect(response.status).toBe(400);
          expect(response.body.code).toBe("INVALID_LIMIT");
        }
      }

      expect((await securityAgent.get("/api/v1/customer-interactions?limit=100")).status).toBe(200);
      expect(storage.getCustomerInteractions).toHaveBeenCalledWith(1, undefined, undefined, 100);
      expect((await securityAgent.get("/api/v1/notifications?limit=100")).status).toBe(200);
      expect(storage.getNotifications).toHaveBeenCalledWith(1, undefined, 100);
      expect((await securityAgent.get("/api/v1/cashback/transactions?limit=100")).status).toBe(200);
      expect(storage.getCashbackTransactions).toHaveBeenCalledWith(1, undefined, 100);
    });

    it("validates and forwards integer cashback ledger operations within the active tenant", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);
      vi.mocked(storage.creditCashback).mockResolvedValue({
        id: 1,
        tenantId: 1,
        customerId: 5,
        ruleId: null,
        orderId: null,
        type: "credit",
        amount: 10,
        balance: 10,
        amountCents: 1000,
        balanceCents: 1000,
        idempotencyKey: "route-credit-1",
        requestHash: "hash",
        source: "manual",
        reversalOfId: null,
        description: "Manual credit",
        expiresAt: null,
        createdAt: null,
      });
      const response = await securityAgent
        .post("/api/v1/cashback/credit")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customerId: 5,
          amountCents: 1000,
          idempotencyKey: "route-credit-1",
          description: "Manual credit",
          source: "manual",
        });
      expect(response.status).toBe(201);
      expect(storage.creditCashback).toHaveBeenCalledWith(
        1,
        {
          customerId: 5,
          amountCents: 1000,
          idempotencyKey: "route-credit-1",
          description: "Manual credit",
          source: "manual",
        },
        expect.objectContaining({ actorUserId: "manager-p0" }),
      );

      const invalid = await securityAgent
        .post("/api/v1/cashback/debit")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customerId: 5,
          amountCents: 1.5,
          idempotencyKey: "route-debit-1",
          description: "Invalid",
          source: "redemption",
        });
      expect(invalid.status).toBe(400);
      expect(storage.debitCashback).not.toHaveBeenCalled();
    });

    it("neutralizes spreadsheet formulas in server-side exports", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);
      vi.mocked(storage.getCustomers).mockResolvedValue({
        data: [
          { id: 1, tenantId: 1, name: "\t=CMD()", email: " +SUM(1,1)", segment: "VIP" } as any,
        ],
        total: 1,
      });
      const response = await securityAgent.get("/api/v1/export/customers");
      expect(response.status).toBe(200);
      expect(response.body[0]).toMatchObject({ name: "'\t=CMD()", email: "' +SUM(1,1)" });
    });

    it("blocks tenant reads immediately after the active membership is revoked", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);

      vi.mocked(storage.getTenantUser).mockResolvedValue(undefined);
      vi.mocked(storage.getCustomers).mockClear();

      const response = await securityAgent.get("/api/v1/customers");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("TENANT_ACCESS_REVOKED");
      expect(storage.getCustomers).not.toHaveBeenCalled();
    });

    it("strips tenantId from tenant-scoped update payloads", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);

      vi.mocked(storage.updateCustomer).mockResolvedValue({ id: 1, tenantId: 1 } as any);
      vi.mocked(storage.updateProduct).mockResolvedValue({ id: 1, tenantId: 1 } as any);
      vi.mocked(storage.updateOrder).mockResolvedValue({ id: 1, tenantId: 1 } as any);
      vi.mocked(storage.updateAutomation).mockResolvedValue({ id: 1, tenantId: 1 } as any);

      const cases = [
        {
          path: "/api/v1/customers/1",
          spy: storage.updateCustomer,
          body: { name: "Safe update", tenantId: 2 },
        },
        {
          path: "/api/v1/products/1",
          spy: storage.updateProduct,
          body: { name: "Safe update", tenantId: 2 },
        },
        {
          path: "/api/v1/orders/1",
          spy: storage.updateOrder,
          body: { customer: "Safe update", tenantId: 2 },
        },
        {
          path: "/api/v1/automations/1",
          spy: storage.updateAutomation,
          body: { name: "Safe update", tenantId: 2 },
        },
      ];

      for (const testCase of cases) {
        const response = await securityAgent
          .put(testCase.path)
          .set("X-CSRF-Token", csrfToken)
          .send(testCase.body);

        expect(response.status).toBe(200);
        expect(testCase.spy).toHaveBeenCalledWith(
          1,
          1,
          expect.not.objectContaining({ tenantId: expect.anything() }),
        );
      }
    });

    it("rejects related resource IDs that do not belong to the active tenant", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);

      vi.mocked(storage.getCustomer).mockResolvedValue(undefined);

      const orderResponse = await securityAgent
        .post("/api/v1/orders")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customerId: 999,
          customer: "External",
          method: "cash",
          lineItems: [{ productId: 1, quantity: 1 }],
        });
      expect(orderResponse.status).toBe(400);
      expect(orderResponse.body.code).toBe("INVALID_TENANT_REFERENCE");
      expect(storage.createOrderWithLineItems).toHaveBeenCalled();

      const taskResponse = await securityAgent
        .post("/api/v1/seller-tasks")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customerId: 999,
          sellerId: "external-user",
          type: "call",
          dueDate: new Date().toISOString(),
        });
      expect(taskResponse.status).toBe(400);
      expect(taskResponse.body.code).toBe("INVALID_TENANT_REFERENCE");
      expect(storage.createSellerTask).not.toHaveBeenCalled();

      const interactionResponse = await securityAgent
        .post("/api/v1/customer-interactions")
        .set("X-CSRF-Token", csrfToken)
        .send({ customerId: 999, type: "contact", channel: "phone" });
      expect(interactionResponse.status).toBe(400);
      expect(interactionResponse.body.code).toBe("INVALID_TENANT_REFERENCE");
      expect(storage.createCustomerInteraction).not.toHaveBeenCalled();

      vi.mocked(storage.getTenantUser).mockImplementation(
        async (_tenantId: number, userId: string) =>
          userId === "manager-p0"
            ? {
                id: 1,
                tenantId: 1,
                userId,
                role: "manager",
                isActive: true,
                createdAt: null,
                updatedAt: null,
              }
            : undefined,
      );
      const goalsResponse = await securityAgent
        .post("/api/v1/seller-goals")
        .set("X-CSRF-Token", csrfToken)
        .send({ sellerId: "external-user", dailyTaskGoal: 10 });
      expect(goalsResponse.status).toBe(400);
      expect(goalsResponse.body.code).toBe("INVALID_TENANT_REFERENCE");
      expect(storage.upsertSellerGoals).not.toHaveBeenCalled();
    });

    it("requires the transactional lineItems contract and exposes tenant-scoped item snapshots", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);
      const createdOrder = {
        id: 77,
        tenantId: 1,
        orderId: "ORD-server-generated",
        customerId: null,
        customer: "Cliente",
        orderDate: new Date().toISOString(),
        total: 25,
        totalCents: 2500,
        status: "Pendente",
        items: 2,
        method: "PIX",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.createOrderWithLineItems).mockResolvedValue(createdOrder);

      const response = await securityAgent
        .post("/api/v1/orders")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customer: "Cliente",
          method: "PIX",
          orderId: "CLIENT-CANNOT-SET",
          total: 1,
          orderDate: "2026-08-29",
          lineItems: [{ productId: 5, quantity: 2 }],
        });
      expect(response.status).toBe(201);
      expect(storage.createOrderWithLineItems).toHaveBeenCalledWith({
        tenantId: 1,
        customer: "Cliente",
        method: "PIX",
        orderDate: "2026-08-29",
        lineItems: [{ productId: 5, quantity: 2 }],
      });
      expect(storage.createOrder).not.toHaveBeenCalled();

      const invalidDateResponse = await securityAgent
        .post("/api/v1/orders")
        .set("X-CSRF-Token", csrfToken)
        .send({
          customer: "Cliente",
          method: "PIX",
          orderDate: "2026-02-31",
          lineItems: [{ productId: 5, quantity: 1 }],
        });
      expect(invalidDateResponse.status).toBe(400);
      expect(storage.createOrderWithLineItems).toHaveBeenCalledTimes(1);

      const legacyResponse = await securityAgent
        .post("/api/v1/orders")
        .set("X-CSRF-Token", csrfToken)
        .send({ orderId: "LEGACY-1", customer: "Cliente", method: "PIX", total: 10, items: 1 });
      expect(legacyResponse.status).toBe(400);
      expect(storage.createOrder).not.toHaveBeenCalled();

      vi.mocked(storage.getOrder).mockResolvedValue(createdOrder);
      vi.mocked(storage.getOrderItems).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          orderId: 77,
          productId: 5,
          quantity: 2,
          unitPriceCents: 1250,
          lineTotalCents: 2500,
          createdAt: null,
        },
      ]);
      const itemsResponse = await securityAgent.get("/api/v1/orders/77/items");
      expect(itemsResponse.status).toBe(200);
      expect(itemsResponse.body).toEqual([
        expect.objectContaining({ orderId: 77, productId: 5, quantity: 2 }),
      ]);
      expect(storage.getOrderItems).toHaveBeenCalledWith(1, 77);
    });

    it("rejects attempts to mutate derived commercial order fields", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);

      for (const body of [
        { orderId: "FORGED" },
        { total: 0 },
        { totalCents: 0 },
        { items: 0 },
        { lineItems: [{ productId: 1, quantity: 1 }] },
      ]) {
        const response = await securityAgent
          .put("/api/v1/orders/77")
          .set("X-CSRF-Token", csrfToken)
          .send(body);
        expect(response.status).toBe(400);
      }
      expect(storage.updateOrder).not.toHaveBeenCalled();
      expect(storage.cancelOrder).not.toHaveBeenCalled();
    });

    it("routes PUT Cancelado and DELETE through idempotent cancellation", async () => {
      const securityAgent = request.agent(app);
      const csrfToken = await loginAsManager(securityAgent);
      const cancelled = {
        id: 77,
        tenantId: 1,
        orderId: "ORD-1",
        customerId: null,
        customer: "Cliente",
        orderDate: null,
        total: 25,
        totalCents: 2500,
        status: "Cancelado",
        items: 2,
        method: "PIX",
        createdAt: null,
        updatedAt: null,
      };
      vi.mocked(storage.cancelOrder).mockResolvedValue(cancelled);
      vi.mocked(storage.deleteOrder).mockResolvedValue(true);

      const updateResponse = await securityAgent
        .put("/api/v1/orders/77")
        .set("X-CSRF-Token", csrfToken)
        .send({ status: "Cancelado" });
      expect(updateResponse.status).toBe(200);
      expect(storage.cancelOrder).toHaveBeenCalledWith(
        1,
        77,
        expect.objectContaining({
          action: "order.cancelled",
          tenantId: 1,
        }),
      );
      expect(storage.updateOrder).not.toHaveBeenCalled();

      const deleteResponse = await securityAgent
        .delete("/api/v1/orders/77")
        .set("X-CSRF-Token", csrfToken);
      expect(deleteResponse.status).toBe(200);
      expect(storage.deleteOrder).toHaveBeenCalledWith(
        1,
        77,
        expect.objectContaining({
          action: "order.cancelled",
          tenantId: 1,
        }),
      );
    });

    it("forwards closed list filters and preserves pagination envelopes", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);

      vi.mocked(storage.getCustomers).mockResolvedValue({ data: [], total: 7 });
      vi.mocked(storage.getProducts).mockResolvedValue({ data: [], total: 5 });
      vi.mocked(storage.getOrders).mockResolvedValue({ data: [], total: 3 });

      const customersResponse = await securityAgent.get(
        "/api/v1/customers?page=2&limit=20&search=moda&segment=VIP&sort=name&order=asc",
      );
      expect(customersResponse.status).toBe(200);
      expect(customersResponse.body.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 7,
        totalPages: 1,
      });
      expect(storage.getCustomers).toHaveBeenCalledWith(1, {
        limit: 20,
        offset: 20,
        search: "moda",
        segment: "VIP",
        sort: "name",
        order: "asc",
      });

      const productsResponse = await securityAgent.get(
        "/api/v1/products?page=1&limit=20&search=camisa&status=Ativo&sort=name&order=desc",
      );
      expect(productsResponse.status).toBe(200);
      expect(productsResponse.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 5,
        totalPages: 1,
      });
      expect(storage.getProducts).toHaveBeenCalledWith(1, {
        limit: 20,
        offset: 0,
        search: "camisa",
        status: "Ativo",
        sort: "name",
        order: "desc",
      });

      const ordersResponse = await securityAgent.get(
        "/api/v1/orders?page=1&limit=20&search=cliente&status=Pago&sort=orderDate&order=desc",
      );
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
      expect(storage.getOrders).toHaveBeenCalledWith(1, {
        limit: 20,
        offset: 0,
        search: "cliente",
        status: "Pago",
        sort: "orderDate",
        order: "desc",
      });
    });

    it("rejects unknown list fields, free-form sort columns, and limits above 100", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);

      vi.mocked(storage.getCustomers).mockClear();
      vi.mocked(storage.getProducts).mockClear();
      vi.mocked(storage.getOrders).mockClear();

      const responses = [];
      for (const path of [
        "/api/v1/customers?sort=email",
        "/api/v1/products?sort=price",
        "/api/v1/orders?sort=customer",
        "/api/v1/customers?limit=101",
        "/api/v1/customers?unknown=value",
      ]) {
        responses.push(await securityAgent.get(path));
      }

      responses.forEach((response) => {
        expect(response.status).toBe(400);
        expect(response.body.code).toBe("INVALID_QUERY");
      });
      expect(storage.getCustomers).not.toHaveBeenCalled();
      expect(storage.getProducts).not.toHaveBeenCalled();
      expect(storage.getOrders).not.toHaveBeenCalled();
    });

    it("reads audit events only through the active tenant context and rejects tenant query overrides", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);
      vi.mocked(storage.getAuditEvents).mockResolvedValue({
        data: [
          {
            id: 10,
            tenantId: 1,
            actorUserId: "manager-p0",
            action: "data.exported",
            targetType: "customers",
            targetId: null,
            outcome: "success",
            requestId: "req-10",
            createdAt: new Date().toISOString(),
            metadata: { rowCount: 1 },
          },
        ],
        total: 1,
      });

      const response = await securityAgent.get("/api/v1/audit-events?page=1&limit=25");
      expect(response.status).toBe(200);
      expect(storage.getAuditEvents).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 1 }));

      const override = await securityAgent.get("/api/v1/audit-events?tenantId=2");
      expect(override.status).toBe(400);
    });

    it("denies tenant audit events to sellers", async () => {
      const sellerAgent = request.agent(app);
      const seller = {
        id: "seller-audit",
        email: "seller-audit@example.com",
        cpf: "98765432100",
        sellerCode: null,
        password: "$2b$10$hashedpassword",
        name: "Seller Audit",
        phone: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        emailVerified: true,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.getUserByCpf).mockResolvedValue(seller);
      vi.mocked(storage.getUserTenants).mockResolvedValue([
        {
          id: 1,
          tenantId: 1,
          userId: seller.id,
          role: "seller",
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
      ]);
      vi.mocked(storage.getTenantUser).mockResolvedValue({
        id: 1,
        tenantId: 1,
        userId: seller.id,
        role: "seller",
        isActive: true,
        createdAt: null,
        updatedAt: null,
      });
      vi.mocked(storage.updateUser).mockResolvedValue(seller);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      expect(
        (
          await sellerAgent
            .post("/api/v1/auth/login")
            .send({ username: seller.cpf, password: "password123" })
        ).status,
      ).toBe(200);

      expect((await sellerAgent.get("/api/v1/audit-events")).status).toBe(403);
      expect(storage.getAuditEvents).not.toHaveBeenCalled();
    });

    it("allows super admins to read the global audit stream", async () => {
      const adminAgent = request.agent(app);
      const admin = {
        id: "audit-admin",
        email: "audit-admin@example.com",
        cpf: "11122233344",
        sellerCode: null,
        password: "$2b$10$hashedpassword",
        name: "Audit Admin",
        phone: null,
        isSuperAdmin: true,
        mustChangePassword: false,
        emailVerified: true,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.getUserByCpf).mockResolvedValue(admin);
      vi.mocked(storage.getUser).mockResolvedValue(admin);
      vi.mocked(storage.updateUser).mockResolvedValue(admin);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      expect(
        (
          await adminAgent
            .post("/api/v1/auth/login")
            .send({ username: admin.cpf, password: "password123" })
        ).status,
      ).toBe(200);

      const response = await adminAgent.get("/api/v1/admin/audit-events?page=1&limit=25");
      expect(response.status).toBe(200);
      expect(storage.getAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({ global: true }),
      );
    });

    it("validates the explicit UTC report contract and delegates without listing limits", async () => {
      const securityAgent = request.agent(app);
      await loginAsManager(securityAgent);
      vi.mocked(storage.getSalesReport).mockResolvedValue({
        timezone: "UTC",
        range: { startDate: "2025-01-01", endDate: "2025-12-31" },
        summary: {
          totalRevenue: 0,
          totalRevenueCents: 0,
          totalOrders: 0,
          averageTicket: 0,
          averageTicketCents: 0,
          totalCustomers: 0,
          totalProducts: 0,
        },
        salesByMonth: [],
        salesByCategory: [],
        customersBySegment: [],
        topCustomers: [],
        campaignStats: [],
        orders: [],
      });

      const response = await securityAgent.get(
        "/api/v1/reports?startDate=2025-01-01&endDate=2025-12-31&timezone=UTC",
      );
      expect(response.status).toBe(200);
      expect(storage.getSalesReport).toHaveBeenCalledWith(1, {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        timezone: "UTC",
      });
      expect(storage.getOrders).not.toHaveBeenCalled();

      for (const query of [
        "startDate=2025-01-01",
        "startDate=2025-02-30&endDate=2025-03-01",
        "startDate=2025-03-01&endDate=2025-02-01",
        "timezone=America%2FSao_Paulo",
      ]) {
        const invalid = await securityAgent.get(`/api/v1/reports?${query}`);
        expect(invalid.status).toBe(400);
        expect(invalid.body.code).toBe("INVALID_REPORT_QUERY");
      }
    });
  });
});
