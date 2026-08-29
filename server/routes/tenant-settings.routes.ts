import type { Router } from "express";
import { getTenantId, requireAuth, requireRole, sendError, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Store settings owned by a tenant manager.
 */
export function registerTenantSettingsRoutes(v1Router: Router): void {
  // ==================== TENANT SETTINGS (FOR MANAGERS) ====================
  v1Router.get(
    "/tenant/settings",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: "Tenant não encontrado" });
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
        res.status(500).json({ error: "Erro ao buscar configurações" });
      }
    },
  );

  v1Router.put(
    "/tenant/settings",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { name, logo, primaryColor, secondaryColor, loginMessage } = req.body;

        const updateData: Record<string, any> = {};

        if (name !== undefined && typeof name === "string" && name.trim().length > 0) {
          updateData.name = name.trim();
        }

        if (logo !== undefined) {
          if (logo === null) {
            updateData.logo = null;
          } else if (typeof logo === "string" && logo.trim().length > 0) {
            updateData.logo = logo.trim();
          }
        }

        if (primaryColor !== undefined) {
          if (primaryColor === null) {
            updateData.primaryColor = null;
          } else if (typeof primaryColor === "string" && primaryColor.trim().length > 0) {
            updateData.primaryColor = primaryColor.trim();
          }
        }

        if (secondaryColor !== undefined) {
          if (secondaryColor === null) {
            updateData.secondaryColor = null;
          } else if (typeof secondaryColor === "string" && secondaryColor.trim().length > 0) {
            updateData.secondaryColor = secondaryColor.trim();
          }
        }

        if (loginMessage !== undefined) {
          if (loginMessage === null) {
            updateData.loginMessage = null;
          } else if (typeof loginMessage === "string" && loginMessage.trim().length > 0) {
            updateData.loginMessage = loginMessage.trim();
          }
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        const updated = await storage.updateTenant(tenantId, updateData);

        if (!updated) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }

        res.json({
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          logo: updated.logo,
          primaryColor: updated.primaryColor,
          secondaryColor: updated.secondaryColor,
          loginMessage: updated.loginMessage,
        });
      } catch {
        res.status(500).json({ error: "Erro ao atualizar configurações" });
      }
    },
  );
}
