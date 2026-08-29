import type { Router } from "express";
import {
  logger,
  publicContactSchema,
  publicDemoSchema,
  publicLeadLimiter,
  PRIVACY_POLICY_VERSION,
  sendError,
  storage,
  ZodError,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Public lead capture from the landing page.
 *
 * These are the only unauthenticated endpoints that persist personal data, so
 * they carry their own controls: a strict rate limit, a closed payload that
 * refuses unknown fields (a visitor must not be able to set `status`), bounded
 * string lengths, a hidden honeypot and mandatory, recorded consent.
 */
export function registerPublicContactRoutes(v1Router: Router): void {
  /** A filled honeypot means a bot; answer as success so it learns nothing. */
  function looksAutomated(body: unknown): boolean {
    const website = (body as { website?: unknown } | null)?.website;
    return typeof website === "string" && website.trim().length > 0;
  }

  function handleInvalid(res: Response, error: unknown, fallback: string) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return sendError(res, 400, first?.message ?? fallback, "VALIDATION_ERROR");
    }
    return sendError(res, 400, fallback, "VALIDATION_ERROR");
  }

  v1Router.post("/contact", publicLeadLimiter, async (req: Request, res: Response) => {
    if (looksAutomated(req.body)) {
      logger.info("Public contact submission discarded by honeypot", {
        requestId: req.requestId,
      });
      return res.status(201).json({ message: "Mensagem enviada com sucesso!" });
    }

    try {
      const input = publicContactSchema.parse(req.body);
      const created = await storage.createContactRequest({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message,
        // Owned by the server: a public caller never chooses the triage state.
        status: "pending",
        consentAcceptedAt: new Date().toISOString(),
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
      });
      res.status(201).json({ message: "Mensagem enviada com sucesso!", id: created.id });
    } catch (error) {
      return handleInvalid(res, error, "Dados de contato inválidos");
    }
  });

  v1Router.post("/demo", publicLeadLimiter, async (req: Request, res: Response) => {
    if (looksAutomated(req.body)) {
      logger.info("Public demo submission discarded by honeypot", { requestId: req.requestId });
      return res.status(201).json({ message: "Solicitação de demo enviada com sucesso!" });
    }

    try {
      const input = publicDemoSchema.parse(req.body);
      const created = await storage.createDemoRequest({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        company: input.company,
        storeCount: input.storeCount ?? null,
        preferredDate: input.preferredDate ?? null,
        message: input.message ?? null,
        status: "pending",
        consentAcceptedAt: new Date().toISOString(),
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
      });
      res.status(201).json({ message: "Solicitação de demo enviada com sucesso!", id: created.id });
    } catch (error) {
      return handleInvalid(res, error, "Dados da solicitação inválidos");
    }
  });

  // Lets the landing page render the exact policy version the visitor consents to.
  v1Router.get("/privacy-policy-version", (_req: Request, res: Response) => {
    res.json({ version: PRIVACY_POLICY_VERSION });
  });
}
