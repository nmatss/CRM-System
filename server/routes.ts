import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCustomerSchema,
  insertProductSchema,
  insertOrderSchema,
  insertCashbackRuleSchema,
  insertCampaignSchema,
  insertAutomationSchema,
  insertTenantSchema,
  insertContactRequestSchema,
  insertDemoRequestSchema,
  insertSellerTaskSchema,
  loginSchema,
  registerSchema,
} from "@shared/schema";
import {
  setupSession,
  hashPassword,
  comparePassword,
  requireAuth,
  requireSuperAdmin,
  requireTenantAccess,
  requireRole,
  createSuperAdminIfNotExists,
} from "./auth";

function getTenantId(req: Request): number {
  return req.session.user?.tenantId || parseInt(req.params.tenantId || req.query.tenantId as string);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupSession(app);
  
  await createSuperAdminIfNotExists();

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      // Try to find user by CPF first (cleaned), then by email
      const cleanedCpf = username.replace(/\D/g, '');
      let user = await storage.getUserByCpf(cleanedCpf);
      if (!user) {
        user = await storage.getUserByEmail(username);
      }
      
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }
      
      if (user.status !== "active") {
        return res.status(401).json({ error: "Usuário inativo. Entre em contato com o administrador." });
      }
      
      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }
      
      let tenantId: number | undefined;
      let role: string | undefined;
      
      if (!user.isSuperAdmin) {
        const userTenants = await storage.getUserTenants(user.id);
        const activeTenant = userTenants.find(tu => tu.isActive);
        if (activeTenant) {
          tenantId = activeTenant.tenantId;
          role = activeTenant.role;
        }
      }
      
      // Update last login
      await storage.updateUser(user.id, { lastLogin: new Date() } as any);
      
      req.session.user = {
        id: user.id,
        email: user.email,
        cpf: user.cpf,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
        tenantId,
        role: role as any,
      };
      
      res.json({ 
        user: req.session.user,
        message: "Login realizado com sucesso" 
      });
    } catch (error) {
      res.status(400).json({ error: "Dados de login inválidos" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    res.json({ user: req.session.user });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, tenantName } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já está em uso" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        isSuperAdmin: false,
      });
      
      let tenantId: number | undefined;
      let role: string = "manager";
      
      if (tenantName) {
        const slug = tenantName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const tenant = await storage.createTenant({
          name: tenantName,
          slug,
          plan: "free",
          status: "active",
        });
        tenantId = tenant.id;
        
        await storage.createTenantUser({
          tenantId: tenant.id,
          userId: user.id,
          role: "manager",
        });
      }
      
      req.session.user = {
        id: user.id,
        email: user.email,
        cpf: user.cpf,
        name: user.name,
        isSuperAdmin: false,
        mustChangePassword: false,
        tenantId,
        role: role as any,
      };
      
      res.status(201).json({ 
        user: req.session.user,
        message: "Registro realizado com sucesso" 
      });
    } catch (error) {
      res.status(400).json({ error: "Dados de registro inválidos" });
    }
  });

  // Change password route
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "As senhas não conferem" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
      }
      
      const user = await storage.getUser(req.session.user!.id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const isValid = await comparePassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Senha atual incorreta" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      req.session.user!.mustChangePassword = false;
      
      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      res.status(400).json({ error: "Erro ao alterar senha" });
    }
  });

  app.post("/api/auth/switch-tenant/:tenantId", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const userId = req.session.user!.id;
      
      if (req.session.user!.isSuperAdmin) {
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }
        req.session.user!.tenantId = tenantId;
        req.session.user!.role = "manager";
        return res.json({ user: req.session.user });
      }
      
      const tenantUser = await storage.getTenantUser(tenantId, userId);
      if (!tenantUser) {
        return res.status(403).json({ error: "Acesso negado a este tenant" });
      }
      
      req.session.user!.tenantId = tenantId;
      req.session.user!.role = tenantUser.role as any;
      
      res.json({ user: req.session.user });
    } catch (error) {
      res.status(500).json({ error: "Erro ao trocar tenant" });
    }
  });

  // ==================== PUBLIC TENANT ROUTES ====================
  app.get("/api/tenants/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const tenant = await storage.getTenantBySlug(slug);
      
      if (!tenant) {
        return res.status(404).json({ error: "Loja não encontrada" });
      }
      
      if (tenant.status !== "active") {
        return res.status(403).json({ error: "Esta loja não está ativa" });
      }
      
      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        loginMessage: tenant.loginMessage,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar loja" });
    }
  });

  // ==================== ADMIN ROUTES ====================
  app.get("/api/admin/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tenants" });
    }
  });

  app.post("/api/admin/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validatedData);
      res.status(201).json(tenant);
    } catch (error) {
      res.status(400).json({ error: "Dados de tenant inválidos" });
    }
  });

  app.put("/api/admin/tenants/:tenantId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const { name, slug, plan, status, logo, primaryColor, secondaryColor, loginMessage } = req.body;
      
      const updateData: Record<string, string | null | undefined> = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (plan !== undefined) updateData.plan = plan;
      if (status !== undefined) updateData.status = status;
      if (logo !== undefined) updateData.logo = logo || null;
      if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
      if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
      if (loginMessage !== undefined) updateData.loginMessage = loginMessage || null;
      
      const updated = await storage.updateTenant(tenantId, updateData as any);
      
      if (!updated) {
        return res.status(404).json({ error: "Tenant não encontrado" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating tenant:", error);
      res.status(400).json({ error: "Erro ao atualizar tenant" });
    }
  });

  app.get("/api/admin/tenants/:tenantId/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const tenantUsers = await storage.getTenantUsers(tenantId);
      res.json(tenantUsers);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuários do tenant" });
    }
  });

  app.delete("/api/admin/tenants/:tenantId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const deleted = await storage.deleteTenant(tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Tenant não encontrado" });
      }
      res.json({ message: "Tenant excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir tenant" });
    }
  });

  // ==================== ADMIN USER MANAGEMENT ====================
  app.get("/api/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      const tenants = await storage.getTenants();
      
      const usersWithTenants = await Promise.all(users.map(async ({ password, ...user }) => {
        const userTenants = await storage.getUserTenants(user.id);
        return {
          ...user,
          tenantUsers: userTenants.map(tu => ({
            ...tu,
            tenant: tenants.find(t => t.id === tu.tenantId)
          }))
        };
      }));
      
      res.json(usersWithTenants);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { email, password, name, cpf, sellerCode, phone, isSuperAdmin, tenantId, role } = req.body;
      
      // Check for duplicate CPF
      if (cpf) {
        const existingByCpf = await storage.getUserByCpf(cpf);
        if (existingByCpf) {
          return res.status(400).json({ error: "CPF já está em uso" });
        }
      }
      
      // Check for duplicate email only if provided
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: "Email já está em uso" });
        }
      }
      
      const finalPassword = password || sellerCode;
      if (!finalPassword) {
        return res.status(400).json({ error: "Senha ou código vendedor é obrigatório" });
      }
      
      const hashedPassword = await hashPassword(finalPassword);
      const user = await storage.createUser({
        email: email || null,
        cpf: cpf || null,
        sellerCode: sellerCode || null,
        phone: phone || null,
        password: hashedPassword,
        name,
        isSuperAdmin: isSuperAdmin || false,
        mustChangePassword: !isSuperAdmin,
      });
      
      if (tenantId && !isSuperAdmin) {
        await storage.createTenantUser({
          tenantId: parseInt(tenantId),
          userId: user.id,
          role: role || "seller",
        });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: "Erro ao criar usuário" });
    }
  });

  app.put("/api/admin/users/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { name, email, password, isSuperAdmin } = req.body;
      
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (password) updateData.password = await hashPassword(password);
      if (isSuperAdmin !== undefined) updateData.isSuperAdmin = isSuperAdmin;
      
      const updated = await storage.updateUser(userId, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/admin/users/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (req.session.user?.id === userId) {
        return res.status(400).json({ error: "Você não pode excluir seu próprio usuário" });
      }
      
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir usuário" });
    }
  });

  app.post("/api/admin/users/:userId/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { tenantId, role } = req.body;
      
      const existing = await storage.getTenantUser(parseInt(tenantId), userId);
      if (existing) {
        const updated = await storage.updateTenantUserRole(parseInt(tenantId), userId, role || "seller");
        return res.json(updated);
      }
      
      const tenantUser = await storage.createTenantUser({
        tenantId: parseInt(tenantId),
        userId,
        role: role || "seller",
      });
      res.status(201).json(tenantUser);
    } catch (error) {
      res.status(400).json({ error: "Erro ao vincular usuário ao tenant" });
    }
  });

  app.delete("/api/admin/users/:userId/tenants/:tenantId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = req.params;
      const deleted = await storage.deleteTenantUser(parseInt(tenantId), userId);
      if (!deleted) {
        return res.status(404).json({ error: "Vínculo não encontrado" });
      }
      res.json({ message: "Vínculo removido com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao remover vínculo" });
    }
  });

  app.post("/api/admin/users/:userId/reset-password", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const newPassword = user.sellerCode || "123456";
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);
      
      res.json({ message: "Senha resetada com sucesso", temporaryPassword: newPassword });
    } catch (error) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  // ==================== TENANT USER MANAGEMENT (FOR MANAGERS) ====================
  app.get("/api/team", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const tenantUsers = await storage.getTenantUsers(tenantId);
      const usersWithDetails = await Promise.all(tenantUsers.map(async (tu) => {
        const user = await storage.getUser(tu.userId);
        if (!user) return null;
        const { password, ...userWithoutPassword } = user;
        return { ...tu, user: userWithoutPassword };
      }));
      
      res.json(usersWithDetails.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar equipe" });
    }
  });

  app.post("/api/team", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const { name, cpf, sellerCode, phone, email, role } = req.body;
      
      if (cpf) {
        const existingByCpf = await storage.getUserByCpf(cpf);
        if (existingByCpf) {
          return res.status(400).json({ error: "CPF já está em uso" });
        }
      }
      
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: "Email já está em uso" });
        }
      }
      
      const finalPassword = sellerCode || "123456";
      const hashedPassword = await hashPassword(finalPassword);
      
      const user = await storage.createUser({
        email: email || null,
        cpf: cpf || null,
        sellerCode: sellerCode || null,
        phone: phone || null,
        password: hashedPassword,
        name,
        isSuperAdmin: false,
        mustChangePassword: true,
      });
      
      await storage.createTenantUser({
        tenantId,
        userId: user.id,
        role: role || "seller",
      });
      
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating team member:", error);
      res.status(400).json({ error: "Erro ao criar membro da equipe" });
    }
  });

  app.put("/api/team/:userId", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const { userId } = req.params;
      const { name, phone, role } = req.body;
      
      const tenantUser = await storage.getTenantUser(tenantId, userId);
      if (!tenantUser) {
        return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
      }
      
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      
      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(userId, updateData);
      }
      
      if (role !== undefined) {
        await storage.updateTenantUserRole(tenantId, userId, role);
      }
      
      res.json({ message: "Membro atualizado com sucesso" });
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar membro" });
    }
  });

  app.post("/api/team/:userId/reset-password", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const { userId } = req.params;
      
      const tenantUser = await storage.getTenantUser(tenantId, userId);
      if (!tenantUser) {
        return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const newPassword = user.sellerCode || "123456";
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);
      
      res.json({ message: "Senha resetada com sucesso", temporaryPassword: newPassword });
    } catch (error) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.delete("/api/team/:userId", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const { userId } = req.params;
      
      if (req.session.user?.id === userId) {
        return res.status(400).json({ error: "Você não pode remover a si mesmo" });
      }
      
      const tenantUser = await storage.getTenantUser(tenantId, userId);
      if (!tenantUser) {
        return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
      }
      
      await storage.deleteTenantUser(tenantId, userId);
      
      res.json({ message: "Membro removido da equipe" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao remover membro" });
    }
  });

  // ==================== TENANT-SCOPED DATA ROUTES ====================
  app.get("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const customers = await storage.getCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertCustomerSchema.parse({ ...req.body, tenantId });
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid customer data" });
    }
  });

  app.put("/api/customers/:id", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const customerId = parseInt(req.params.id);
      const updated = await storage.updateCustomer(tenantId, customerId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar cliente" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const customerId = parseInt(req.params.id);
      const deleted = await storage.deleteCustomer(tenantId, customerId);
      if (!deleted) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }
      res.json({ message: "Cliente excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir cliente" });
    }
  });

  app.get("/api/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const products = await storage.getProducts(tenantId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertProductSchema.parse({ ...req.body, tenantId });
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const productId = parseInt(req.params.id);
      const updated = await storage.updateProduct(tenantId, productId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const productId = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(tenantId, productId);
      if (!deleted) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }
      res.json({ message: "Produto excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir produto" });
    }
  });

  app.get("/api/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const orders = await storage.getOrders(tenantId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertOrderSchema.parse({ ...req.body, tenantId });
      const order = await storage.createOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid order data" });
    }
  });

  app.put("/api/orders/:id", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const orderId = parseInt(req.params.id);
      const updated = await storage.updateOrder(tenantId, orderId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar pedido" });
    }
  });

  app.delete("/api/orders/:id", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const orderId = parseInt(req.params.id);
      const deleted = await storage.deleteOrder(tenantId, orderId);
      if (!deleted) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      res.json({ message: "Pedido excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir pedido" });
    }
  });

  app.get("/api/cashback-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const rules = await storage.getCashbackRules(tenantId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cashback rules" });
    }
  });

  app.post("/api/cashback-rules", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertCashbackRuleSchema.parse({ ...req.body, tenantId });
      const rule = await storage.createCashbackRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      res.status(400).json({ error: "Invalid cashback rule data" });
    }
  });

  app.get("/api/campaigns", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const campaigns = await storage.getCampaigns(tenantId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/campaigns", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertCampaignSchema.parse({ ...req.body, tenantId });
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(400).json({ error: "Invalid campaign data" });
    }
  });

  app.get("/api/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const automations = await storage.getAutomations(tenantId);
      res.json(automations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automations" });
    }
  });

  app.post("/api/automations", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertAutomationSchema.parse({ ...req.body, tenantId });
      const automation = await storage.createAutomation(validatedData);
      res.status(201).json(automation);
    } catch (error) {
      res.status(400).json({ error: "Invalid automation data" });
    }
  });

  // ==================== USER TENANTS ====================
  app.get("/api/user/tenants", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      
      if (req.session.user!.isSuperAdmin) {
        const allTenants = await storage.getTenants();
        res.json(allTenants);
      } else {
        const userTenants = await storage.getUserTenants(userId);
        const tenantsWithDetails = await Promise.all(
          userTenants.map(async (tu) => {
            const tenant = await storage.getTenant(tu.tenantId);
            return { ...tenant, role: tu.role };
          })
        );
        res.json(tenantsWithDetails);
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tenants do usuário" });
    }
  });

  // ==================== PUBLIC CONTACT/DEMO ROUTES ====================
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactRequestSchema.parse(req.body);
      const contactRequest = await storage.createContactRequest(validatedData);
      res.status(201).json({ message: "Mensagem enviada com sucesso!", id: contactRequest.id });
    } catch (error) {
      res.status(400).json({ error: "Dados de contato inválidos" });
    }
  });

  app.post("/api/demo", async (req: Request, res: Response) => {
    try {
      const validatedData = insertDemoRequestSchema.parse(req.body);
      const demoRequest = await storage.createDemoRequest(validatedData);
      res.status(201).json({ message: "Solicitação de demo enviada com sucesso!", id: demoRequest.id });
    } catch (error) {
      res.status(400).json({ error: "Dados da solicitação inválidos" });
    }
  });

  // ==================== ADMIN CONTACT/DEMO ROUTES ====================
  app.get("/api/admin/contacts", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getContactRequests();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar contatos" });
    }
  });

  app.put("/api/admin/contacts/:id/status", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateContactRequestStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: "Contato não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar status" });
    }
  });

  app.get("/api/admin/demos", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const demos = await storage.getDemoRequests();
      res.json(demos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar demos" });
    }
  });

  app.put("/api/admin/demos/:id/status", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateDemoRequestStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: "Demo não encontrada" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar status" });
    }
  });

  // ==================== ADMIN REPORTS/STATS ====================
  app.get("/api/admin/tenant-stats", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getTenantStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // ==================== SELLER TASKS ====================
  app.get("/api/seller-tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const filters = {
        sellerId: req.query.sellerId as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        type: req.query.type as string | undefined,
      };
      
      const tasks = await storage.getSellerTasks(tenantId, filters);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  app.get("/api/seller-tasks/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      
      const sellerId = req.query.sellerId as string | undefined;
      const stats = await storage.getSellerStats(tenantId, sellerId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  app.post("/api/seller-tasks", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const validatedData = insertSellerTaskSchema.parse({ ...req.body, tenantId });
      const task = await storage.createSellerTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Dados da tarefa inválidos" });
    }
  });

  app.put("/api/seller-tasks/:id", requireAuth, requireRole("manager", "seller"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const taskId = parseInt(req.params.id);
      const { status, notes } = req.body;
      
      const updateData: Record<string, any> = {};
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (notes !== undefined) updateData.notes = notes;
      
      const updated = await storage.updateSellerTask(tenantId, taskId, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Tarefa não encontrada" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar tarefa" });
    }
  });

  app.delete("/api/seller-tasks/:id", requireAuth, requireRole("manager"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant não selecionado" });
      }
      const taskId = parseInt(req.params.id);
      const deleted = await storage.deleteSellerTask(tenantId, taskId);
      if (!deleted) {
        return res.status(404).json({ error: "Tarefa não encontrada" });
      }
      res.json({ message: "Tarefa excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir tarefa" });
    }
  });

  return httpServer;
}
