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
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }
      
      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }
      
      let tenantId: number | undefined;
      let role: string | undefined;
      
      if (!user.isSuperAdmin) {
        const userTenants = await storage.getUserTenants(user.id);
        if (userTenants.length > 0) {
          tenantId = userTenants[0].tenantId;
          role = userTenants[0].role;
        }
      }
      
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
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
        name: user.name,
        isSuperAdmin: false,
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

  return httpServer;
}
