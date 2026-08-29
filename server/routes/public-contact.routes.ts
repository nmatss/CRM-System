import type { Router } from "express";
import { insertContactRequestSchema, insertDemoRequestSchema, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Public contact and demo requests.
 */
export function registerPublicContactRoutes(v1Router: Router): void {
  // ==================== PUBLIC CONTACT/DEMO ROUTES ====================
  v1Router.post("/contact", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactRequestSchema.parse(req.body);
      const contactRequest = await storage.createContactRequest(validatedData);
      res.status(201).json({ message: "Mensagem enviada com sucesso!", id: contactRequest.id });
    } catch {
      res.status(400).json({ error: "Dados de contato inválidos" });
    }
  });

  v1Router.post("/demo", async (req: Request, res: Response) => {
    try {
      const validatedData = insertDemoRequestSchema.parse(req.body);
      const demoRequest = await storage.createDemoRequest(validatedData);
      res
        .status(201)
        .json({ message: "Solicitação de demo enviada com sucesso!", id: demoRequest.id });
    } catch {
      res.status(400).json({ error: "Dados da solicitação inválidos" });
    }
  });
}
