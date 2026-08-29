import type { Express } from "express";
import express from "express";
import { type Server } from "http";
import { setupSession, createSuperAdminIfNotExists } from "./auth";
import { setupCsrf } from "./csrf";
import { checkAndSeed } from "./seed";
import { sendError } from "./routes/shared";
import type { Request, Response } from "express";

import { registerSystemRoutes } from "./routes/system.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerPublicTenantRoutes } from "./routes/public-tenant.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerTenantSettingsRoutes } from "./routes/tenant-settings.routes";
import { registerTeamRoutes } from "./routes/team.routes";
import { registerDashboardRoutes } from "./routes/dashboard.routes";
import { registerCustomerRoutes } from "./routes/customers.routes";
import { registerProductRoutes } from "./routes/products.routes";
import { registerOrderRoutes } from "./routes/orders.routes";
import { registerCashbackRuleRoutes } from "./routes/cashback-rules.routes";
import { registerCampaignRoutes } from "./routes/campaigns.routes";
import { registerAutomationRoutes } from "./routes/automations.routes";
import { registerUserTenantRoutes } from "./routes/user-tenants.routes";
import { registerPublicContactRoutes } from "./routes/public-contact.routes";
import { registerAdminLeadRoutes } from "./routes/admin-leads.routes";
import { registerSellerRoutes } from "./routes/seller.routes";
import { registerReportRoutes } from "./routes/reports.routes";
import { registerSearchRoutes } from "./routes/search.routes";
import { registerImportExportRoutes } from "./routes/import-export.routes";
import { registerNotificationRoutes } from "./routes/notifications.routes";
import { registerDashboardChartRoutes } from "./routes/dashboard-charts.routes";
import { registerCashbackRoutes } from "./routes/cashback.routes";
import { registerCustomer360Routes } from "./routes/customer-360.routes";
import { registerCampaignStatsRoutes } from "./routes/campaign-stats.routes";
import { registerAutomationExtraRoutes } from "./routes/automation-extras.routes";

/**
 * Composition root of the HTTP API.
 *
 * Registration order is part of the contract: Express matches routes in the
 * order they are declared, and `registerAdminRoutes` installs the tenant-context
 * middleware that every tenant-scoped router after it relies on. Keep the calls
 * below in this order and add new domains at the position their paths require.
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupSession(app);

  await createSuperAdminIfNotExists();

  // Seed database in development mode
  await checkAndSeed();

  // CSRF needs session state and must be registered before API routes.
  setupCsrf(app);

  const v1Router = express.Router();

  registerSystemRoutes(v1Router, app);
  registerAuthRoutes(v1Router);
  registerPublicTenantRoutes(v1Router);
  // Installs `requireTenantContext` for every tenant-scoped prefix below.
  registerAdminRoutes(v1Router);
  registerTenantSettingsRoutes(v1Router);
  registerTeamRoutes(v1Router);
  registerDashboardRoutes(v1Router);
  registerCustomerRoutes(v1Router);
  registerProductRoutes(v1Router);
  registerOrderRoutes(v1Router);
  registerCashbackRuleRoutes(v1Router);
  registerCampaignRoutes(v1Router);
  registerAutomationRoutes(v1Router);
  registerUserTenantRoutes(v1Router);
  registerPublicContactRoutes(v1Router);
  registerAdminLeadRoutes(v1Router);
  registerSellerRoutes(v1Router);
  registerReportRoutes(v1Router);
  registerSearchRoutes(v1Router);
  registerImportExportRoutes(v1Router);
  registerNotificationRoutes(v1Router);
  registerDashboardChartRoutes(v1Router);
  registerCashbackRoutes(v1Router);
  registerCustomer360Routes(v1Router);
  registerCampaignStatsRoutes(v1Router);
  registerAutomationExtraRoutes(v1Router);

  // Mount v1 API routes
  app.use("/api/v1", v1Router);

  // An unknown API path must answer with JSON. Without this the SPA fallback
  // would return index.html with status 200 and clients would parse HTML as a
  // successful API response.
  app.use("/api", (req: Request, res: Response) => {
    sendError(
      res,
      404,
      `Rota não encontrada: ${req.method} ${req.baseUrl}${req.path}`,
      "ROUTE_NOT_FOUND",
    );
  });

  return httpServer;
}

export { sanitizeSpreadsheetCell } from "./routes/shared";
