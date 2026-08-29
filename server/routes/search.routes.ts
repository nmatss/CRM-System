import type { Router } from "express";
import { getTenantId, handleZodError, requireAuth, sendError, z, ZodError } from "./shared";
import type { Request, Response } from "./shared";
import { searchTenant } from "../services/globalSearch";

/**
 * Global search for the header. Tenant-scoped like every other read: the term
 * never crosses a tenant boundary and the result set is capped.
 */
export function registerSearchRoutes(v1Router: Router): void {
  const searchQuerySchema = z
    .object({
      q: z.string().trim().min(2).max(100),
      limit: z.coerce.number().int().min(1).max(20).default(5),
    })
    .strict();

  v1Router.get("/search", requireAuth, (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const query = searchQuerySchema.parse(req.query);
      res.json(searchTenant(tenantId, query.q, query.limit));
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
      }
      res.status(500).json({ error: "Erro ao buscar" });
    }
  });
}
