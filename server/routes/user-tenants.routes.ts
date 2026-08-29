import type { Router } from "express";
import { requireAuth, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Tenants the authenticated user can switch to.
 */
export function registerUserTenantRoutes(v1Router: Router): void {
  // ==================== USER TENANTS ====================
  v1Router.get("/user/tenants", requireAuth, async (req: Request, res: Response) => {
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
          }),
        );
        res.json(tenantsWithDetails);
      }
    } catch {
      res.status(500).json({ error: "Erro ao buscar tenants do usuário" });
    }
  });
}
