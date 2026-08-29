import type { Router } from "express";
import {
  OrderDomainError,
  ZodError,
  getAuditContext,
  getTenantId,
  handleZodError,
  isCustomerInTenant,
  orderListQuerySchema,
  requireAuth,
  requireRole,
  sendError,
  storage,
  transactionalOrderCreateSchema,
  updateOrderSchema,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Orders, line items and idempotent cancellation.
 */
export function registerOrderRoutes(v1Router: Router): void {
  /**
   * @description Retrieves all orders for the current tenant with pagination support
   * @route GET /api/v1/orders
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of order objects with pagination metadata
   */
  v1Router.get("/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, status, sort, order } = orderListQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getOrders(tenantId, {
        limit,
        offset,
        search,
        status,
        sort,
        order,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "INVALID_QUERY", zodError.details);
      }
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  /**
   * @description Creates a new order in the current tenant
   * @route POST /api/v1/orders
   * @access manager, seller
   * @param {string} customer - Customer name
   * @param {number} total - Order total amount
   * @param {string} status - Order status (Pendente, Concluído, Cancelado)
   * @param {string} orderDate - Order date in ISO format
   * @returns {object} Newly created order object
   */
  v1Router.post(
    "/orders",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const transactionalData = transactionalOrderCreateSchema.parse(req.body);
        const order = await storage.createOrderWithLineItems({ tenantId, ...transactionalData });
        return res.status(201).json(order);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        if (error instanceof OrderDomainError) {
          return sendError(res, 400, error.message, error.code);
        }
        return sendError(res, 400, "Dados de pedido inválidos", "ORDER_CREATE_ERROR");
      }
    },
  );

  v1Router.get("/orders/:id/items", requireAuth, async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0)
      return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
    const order = await storage.getOrder(tenantId, orderId);
    if (!order) return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
    res.json(await storage.getOrderItems(tenantId, orderId));
  });

  /**
   * @description Updates an existing order's information
   * @route PUT /api/v1/orders/:id
   * @access manager, seller
   * @param {number} id - Order ID to update
   * @param {object} updates - Fields to update (customer, total, status, orderDate)
   * @returns {object} Updated order object
   */
  v1Router.put(
    "/orders/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
          return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
        }
        const { tenantId: _ignoredTenantId, ...candidateUpdate } = req.body ?? {};
        const updateData = updateOrderSchema.parse(candidateUpdate);
        if (updateData.customerId && !(await isCustomerInTenant(tenantId, updateData.customerId))) {
          return sendError(
            res,
            400,
            "Cliente inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        const updated =
          updateData.status === "Cancelado"
            ? await storage.cancelOrder(tenantId, orderId, {
                ...getAuditContext(req),
                tenantId,
                action: "order.cancelled",
                targetType: "orders",
                outcome: "success",
              })
            : await storage.updateOrder(tenantId, orderId, updateData);
        if (!updated) {
          return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof OrderDomainError) {
          return sendError(res, 400, error.message, error.code);
        }
        res.status(400).json({ error: "Erro ao atualizar pedido" });
      }
    },
  );

  /**
   * @description Idempotently cancels an order and restores stock once
   * @route DELETE /api/v1/orders/:id
   * @access manager, seller
   * @param {number} id - Order ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/orders/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
          return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteOrder(tenantId, orderId, {
          ...getAuditContext(req),
          tenantId,
          action: "order.cancelled",
          targetType: "orders",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
        }
        res.json({ message: "Pedido cancelado com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao cancelar pedido" });
      }
    },
  );
}
