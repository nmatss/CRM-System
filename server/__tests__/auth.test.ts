import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import {
  hashPassword,
  comparePassword,
  requireAuth,
  requireSuperAdmin,
  requireTenantAccess,
  requireRole,
  createSuperAdminIfNotExists,
} from "../auth";
import { storage } from "../storage";
import type { SessionUser } from "@shared/schema";

// Mock the storage module
vi.mock("../storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    getTenant: vi.fn(),
    getTenantUser: vi.fn(),
    createUser: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe("Authentication Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getUser).mockImplementation(async (id: string) => ({
      id,
      email: id === "123" ? "admin@example.com" : `${id}@example.com`,
      cpf: null,
      sellerCode: null,
      password: "hashedPassword",
      name: id === "123" ? "Super Admin" : "Test User",
      phone: null,
      isSuperAdmin: id === "123",
      mustChangePassword: false,
      emailVerified: true,
      status: "active",
      lastPasswordChange: null,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(storage.getTenantUser).mockImplementation(
      async (_tenantId: number, userId: string) => ({
        id: 1,
        tenantId: 1,
        userId,
        role: userId === "456" ? "manager" : "seller",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  describe("Password Hashing", () => {
    it("should hash a password using bcrypt with correct salt rounds", async () => {
      const password = "mySecurePassword123";
      const hashedPassword = "$2b$10$abcdefghijklmnopqrstuvwxyz123456";

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      const result = await hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it("should handle hashing errors gracefully", async () => {
      const password = "testPassword";
      const error = new Error("Hashing failed");

      vi.mocked(bcrypt.hash).mockRejectedValue(error);

      await expect(hashPassword(password)).rejects.toThrow("Hashing failed");
    });

    it("should hash different passwords to different values", async () => {
      const password1 = "password1";
      const password2 = "password2";
      const hash1 = "$2b$10$hash1";
      const hash2 = "$2b$10$hash2";

      vi.mocked(bcrypt.hash)
        .mockResolvedValueOnce(hash1 as never)
        .mockResolvedValueOnce(hash2 as never);

      const result1 = await hashPassword(password1);
      const result2 = await hashPassword(password2);

      expect(result1).not.toBe(result2);
    });
  });

  describe("Password Comparison", () => {
    it("should return true when password matches hash", async () => {
      const password = "correctPassword";
      const hash = "$2b$10$validHashValue";

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it("should return false when password does not match hash", async () => {
      const password = "wrongPassword";
      const hash = "$2b$10$validHashValue";

      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await comparePassword(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });

    it("should handle comparison errors", async () => {
      const password = "testPassword";
      const hash = "invalidHash";
      const error = new Error("Comparison failed");

      vi.mocked(bcrypt.compare).mockRejectedValue(error);

      await expect(comparePassword(password, hash)).rejects.toThrow("Comparison failed");
    });
  });

  describe("Session Validation - requireAuth", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        session: {} as any,
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        clearCookie: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it("should allow authenticated users to proceed", async () => {
      const sessionUser: SessionUser = {
        id: "123",
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = sessionUser;

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated users with 401", async () => {
      mockReq.session!.user = undefined;

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Autenticação necessária" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests without session", async () => {
      mockReq.session = undefined as any;

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Super Admin Authorization - requireSuperAdmin", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        session: {} as any,
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        clearCookie: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it("should allow super admins to proceed", async () => {
      const superAdminUser: SessionUser = {
        id: "123",
        email: "admin@example.com",
        name: "Super Admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      };
      mockReq.session!.user = superAdminUser;

      await requireSuperAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject non-super-admin users with 403", async () => {
      const regularUser: SessionUser = {
        id: "456",
        email: "user@example.com",
        name: "Regular User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = regularUser;

      await requireSuperAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Acesso restrito a super administradores",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated users with 401", async () => {
      mockReq.session!.user = undefined;

      await requireSuperAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Autenticação necessária" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Tenant Access Control - requireTenantAccess", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        session: {} as any,
        params: {},
        query: {},
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        clearCookie: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it("should allow super admin to access any tenant", async () => {
      const superAdminUser: SessionUser = {
        id: "123",
        email: "admin@example.com",
        name: "Super Admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      };
      mockReq.session!.user = superAdminUser;
      mockReq.params!.tenantId = "1";

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow user to access their own tenant", async () => {
      const tenantUser: SessionUser = {
        id: "456",
        email: "user@example.com",
        name: "Tenant User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = tenantUser;
      mockReq.params!.tenantId = "1";

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject user accessing different tenant with 403", async () => {
      const tenantUser: SessionUser = {
        id: "456",
        email: "user@example.com",
        name: "Tenant User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = tenantUser;
      mockReq.params!.tenantId = "2"; // Different tenant

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Acesso negado a este tenant" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests without tenantId with 400", async () => {
      const tenantUser: SessionUser = {
        id: "456",
        email: "user@example.com",
        name: "Tenant User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = tenantUser;

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Tenant ID é obrigatório" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept tenantId from query parameters", async () => {
      const tenantUser: SessionUser = {
        id: "456",
        email: "user@example.com",
        name: "Tenant User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = tenantUser;
      mockReq.query!.tenantId = "1";

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated users with 401", async () => {
      mockReq.session!.user = undefined;
      mockReq.params!.tenantId = "1";

      await requireTenantAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Role-Based Access Control - requireRole", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        session: {} as any,
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        clearCookie: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it("should allow user with matching role to proceed", async () => {
      const managerUser: SessionUser = {
        id: "456",
        email: "manager@example.com",
        name: "Manager User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "manager",
      };
      mockReq.session!.user = managerUser;

      const middleware = requireRole("manager", "seller");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow super admin regardless of role", async () => {
      const superAdminUser: SessionUser = {
        id: "123",
        email: "admin@example.com",
        name: "Super Admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      };
      mockReq.session!.user = superAdminUser;

      const middleware = requireRole("manager");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject user with insufficient role with 403", async () => {
      const sellerUser: SessionUser = {
        id: "789",
        email: "seller@example.com",
        name: "Seller User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = sellerUser;

      const middleware = requireRole("manager");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Permissão insuficiente" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated users with 401", async () => {
      mockReq.session!.user = undefined;

      const middleware = requireRole("seller");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Autenticação necessária" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject user without active tenant membership with 403", async () => {
      const userWithoutRole: SessionUser = {
        id: "999",
        email: "norole@example.com",
        name: "User Without Role",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
      };
      mockReq.session!.user = userWithoutRole;
      vi.mocked(storage.getTenantUser).mockResolvedValueOnce(undefined);

      const middleware = requireRole("seller");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Acesso negado a este tenant" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept multiple roles", async () => {
      const sellerUser: SessionUser = {
        id: "789",
        email: "seller@example.com",
        name: "Seller User",
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId: 1,
        role: "seller",
      };
      mockReq.session!.user = sellerUser;

      const middleware = requireRole("manager", "seller");
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("Super Admin Creation - createSuperAdminIfNotExists", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should skip super admin creation when no explicit password is configured", async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;

      const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await createSuperAdminIfNotExists();

      expect(storage.getUserByEmail).not.toHaveBeenCalled();
      expect(storage.createUser).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        "[SECURITY] Super admin bootstrap skipped: set ADMIN_PASSWORD explicitly to create the initial account.",
      );

      warningSpy.mockRestore();
    });

    it("should not create super admin if one already exists", async () => {
      process.env.ADMIN_PASSWORD = "ExistingAdminPassword123!";
      const existingAdmin = {
        id: "123",
        email: "admin@zippi.crm",
        name: "Existing Admin",
        isSuperAdmin: true,
        password: "hashedPassword",
        cpf: null,
        sellerCode: null,
        phone: null,
        mustChangePassword: false,
        emailVerified: true,
        status: "active" as const,
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingAdmin);

      await createSuperAdminIfNotExists();

      expect(storage.getUserByEmail).toHaveBeenCalledWith("admin@zippi.crm");
      expect(storage.createUser).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it("should use custom admin credentials from environment variables", async () => {
      process.env.ADMIN_EMAIL = "custom@admin.com";
      process.env.ADMIN_PASSWORD = "CustomPassword123!";

      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(storage.createUser).mockResolvedValue({
        id: "123",
        email: "custom@admin.com",
        name: "Super Admin",
        isSuperAdmin: true,
        password: "hashedPassword",
        cpf: null,
        sellerCode: null,
        phone: null,
        mustChangePassword: true,
        emailVerified: false,
        status: "active",
        lastPasswordChange: null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const hashedPassword = "$2b$10$customHashedPassword";
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createSuperAdminIfNotExists();

      expect(storage.getUserByEmail).toHaveBeenCalledWith("custom@admin.com");
      expect(bcrypt.hash).toHaveBeenCalledWith("CustomPassword123!", 10);
      expect(storage.createUser).toHaveBeenCalledWith({
        email: "custom@admin.com",
        password: hashedPassword,
        name: "Super Admin",
        isSuperAdmin: true,
      });

      consoleSpy.mockRestore();
    });
  });
});
