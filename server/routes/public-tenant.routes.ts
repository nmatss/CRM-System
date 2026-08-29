import type { Router } from "express";
import { storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Public tenant branding used by the tenant login screen.
 */
export function registerPublicTenantRoutes(v1Router: Router): void {
  // ==================== PUBLIC TENANT ROUTES ====================
  v1Router.get("/tenants/by-slug/:slug", async (req: Request, res: Response) => {
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
    } catch {
      res.status(500).json({ error: "Erro ao buscar loja" });
    }
  });
}
