import type { Router } from "express";
import { requireSuperAdmin, sendError, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Super admin triage of contact and demo requests, plus tenant statistics.
 */
export function registerAdminLeadRoutes(v1Router: Router): void {
  // ==================== ADMIN CONTACT/DEMO ROUTES ====================
  v1Router.get("/admin/contacts", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getContactRequests();
      res.json(contacts);
    } catch {
      res.status(500).json({ error: "Erro ao buscar contatos" });
    }
  });

  v1Router.put(
    "/admin/contacts/:id/status",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const { status } = req.body;
        const updated = await storage.updateContactRequestStatus(id, status);
        if (!updated) {
          return res.status(404).json({ error: "Contato não encontrado" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar status" });
      }
    },
  );

  v1Router.get("/admin/demos", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const demos = await storage.getDemoRequests();
      res.json(demos);
    } catch {
      res.status(500).json({ error: "Erro ao buscar demos" });
    }
  });

  v1Router.put(
    "/admin/demos/:id/status",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const { status } = req.body;
        const updated = await storage.updateDemoRequestStatus(id, status);
        if (!updated) {
          return res.status(404).json({ error: "Demo não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar status" });
      }
    },
  );

  // ==================== ADMIN REPORTS/STATS ====================
  v1Router.get("/admin/tenant-stats", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getTenantStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });
}
