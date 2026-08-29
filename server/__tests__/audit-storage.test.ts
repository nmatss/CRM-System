import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sqlite } from "../db";
import { DatabaseStorage, sanitizeAuditMetadata } from "../storage";

const storage = new DatabaseStorage();

describe("durable audit storage", () => {
  it("uses the same LOWER(TRIM(email)) identity expression for legacy login lookup", async () => {
    const suffix = randomUUID();
    const id = `legacy-${suffix}`;
    const canonical = `legacy-${suffix}@example.com`;
    sqlite
      .prepare("INSERT INTO users(id,email,password,name) VALUES(?,?,?,?)")
      .run(id, `  ${canonical.toUpperCase()}  `, "hash", "Legacy");
    expect((await storage.getUserByEmail(canonical))?.id).toBe(id);
    expect(await storage.deleteUser(id)).toBe(true);
  });

  it("strictly allowlists metadata and never persists common sensitive fields", async () => {
    expect(
      sanitizeAuditMetadata("auth.login", {
        identifierType: "email",
        reason: "invalid_credentials",
        email: "person@example.com",
        cpf: "12345678900",
        ip: "203.0.113.10",
        password: "secret",
        nested: { token: "secret" },
      }),
    ).toEqual({ identifierType: "email", reason: "invalid_credentials" });

    const event = await storage.appendAuditEvent({
      requestId: `req-${randomUUID()}`,
      action: "auth.login",
      targetType: "user",
      outcome: "failure",
      metadata: {
        identifierType: "email",
        reason: "invalid_credentials",
        email: "person@example.com",
      },
    });
    expect(event.metadata).toEqual({ identifierType: "email", reason: "invalid_credentials" });
    expect(JSON.stringify(event)).not.toContain("person@example.com");
  });

  it("filters tenant reads and enforces append-only triggers", async () => {
    const requestId = `req-${randomUUID()}`;
    const first = await storage.appendAuditEvent({
      tenantId: 101,
      requestId,
      action: "data.exported",
      targetType: "customers",
      outcome: "success",
      metadata: { entityType: "customers", rowCount: 2 },
    });
    await storage.appendAuditEvent({
      tenantId: 202,
      requestId: `req-${randomUUID()}`,
      action: "data.exported",
      targetType: "customers",
      outcome: "success",
      metadata: { entityType: "customers", rowCount: 9 },
    });

    const tenantResult = await storage.getAuditEvents({ tenantId: 101, limit: 100, offset: 0 });
    expect(tenantResult.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.id, tenantId: 101 })]),
    );
    expect(tenantResult.data.every((event) => event.tenantId === 101)).toBe(true);
    expect(() =>
      sqlite.prepare("UPDATE audit_events SET outcome='failure' WHERE id=?").run(first.id),
    ).toThrow(/append-only/);
    expect(() => sqlite.prepare("DELETE FROM audit_events WHERE id=?").run(first.id)).toThrow(
      /append-only/,
    );
  });

  it("rolls back user creation if membership audit cannot be persisted", async () => {
    const suffix = randomUUID();
    const tenant = await storage.createTenant({
      name: `Atomic ${suffix}`,
      slug: `atomic-${suffix}`,
      plan: "free",
      status: "active",
    });
    const email = `atomic-${suffix}@example.com`;

    await expect(
      storage.createUserWithMembership(
        {
          email,
          password: "already-hashed",
          name: "Atomic User",
          isSuperAdmin: false,
          mustChangePassword: true,
        },
        tenant.id,
        "seller",
        {
          tenantId: tenant.id,
          requestId: "",
          action: "membership.created",
          targetType: "membership",
          outcome: "success",
          metadata: { role: "seller" },
        },
      ),
    ).rejects.toThrow(/requestId/);

    expect(await storage.getUserByEmail(email)).toBeUndefined();
    expect(await storage.getTenantUsers(tenant.id)).toEqual([]);
    expect(await storage.deleteTenant(tenant.id)).toBe(true);
  });

  it("rolls back self-service user when tenant creation collides", async () => {
    const suffix = randomUUID();
    const slug = `collision-${suffix}`;
    const tenant = await storage.createTenant({
      name: "Existing",
      slug,
      plan: "free",
      status: "active",
    });
    const email = `rollback-${suffix}@example.com`;

    await expect(
      storage.registerSelfService(
        {
          email,
          password: "already-hashed",
          name: "Rollback User",
          isSuperAdmin: false,
          mustChangePassword: false,
        },
        { name: "Duplicate", slug, plan: "free", status: "active" },
        {
          requestId: `req-${suffix}`,
          action: "auth.register",
          targetType: "user",
          outcome: "success",
        },
      ),
    ).rejects.toThrow(/UNIQUE/);

    expect(await storage.getUserByEmail(email)).toBeUndefined();
    expect(await storage.deleteTenant(tenant.id)).toBe(true);
  });

  it("rolls back the complete self-service aggregate if audit insertion fails", async () => {
    const suffix = randomUUID();
    const email = `audit-rollback-${suffix}@example.com`;
    const slug = `audit-rollback-${suffix}`;
    await expect(
      storage.registerSelfService(
        {
          email,
          password: "already-hashed",
          name: "Audit rollback",
          isSuperAdmin: false,
          mustChangePassword: false,
        },
        { name: "Audit rollback", slug, plan: "free", status: "active" },
        {
          requestId: "",
          action: "auth.register",
          targetType: "user",
          outcome: "success",
        },
      ),
    ).rejects.toThrow(/requestId/);

    expect(await storage.getUserByEmail(email)).toBeUndefined();
    expect(await storage.getTenantBySlug(slug)).toBeUndefined();
  });

  it("preserves snapshot identifiers after audited user and tenant deletion", async () => {
    const suffix = randomUUID();
    const tenant = await storage.createTenant({
      name: "Delete snapshot",
      slug: `delete-${suffix}`,
      plan: "free",
      status: "active",
    });
    const user = await storage.createUser({
      email: `delete-${suffix}@example.com`,
      password: "already-hashed",
      name: "Delete User",
      isSuperAdmin: false,
      mustChangePassword: true,
    });

    expect(
      await storage.deleteUser(user.id, {
        actorUserId: user.id,
        requestId: `req-${suffix}-user`,
        action: "entity.deleted",
        targetType: "users",
        outcome: "success",
      }),
    ).toBe(true);
    expect(
      await storage.deleteTenant(tenant.id, {
        tenantId: tenant.id,
        requestId: `req-${suffix}-tenant`,
        action: "entity.deleted",
        targetType: "tenants",
        outcome: "success",
      }),
    ).toBe(true);

    const events = await storage.getAuditEvents({ global: true, limit: 100, offset: 0 });
    expect(events.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorUserId: user.id, targetId: user.id }),
        expect.objectContaining({ tenantId: tenant.id, targetId: String(tenant.id) }),
      ]),
    );
  });

  it("audits an idempotent order cancellation once without calling it a deletion", async () => {
    const suffix = randomUUID();
    const tenant = await storage.createTenant({
      name: "Cancel audit",
      slug: `cancel-${suffix}`,
      plan: "free",
      status: "active",
    });
    const product = await storage.createProduct({
      tenantId: tenant.id,
      name: "Product",
      category: "Test",
      price: 12.5,
      stock: 3,
      status: "Ativo",
    });
    const order = await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customer: "Customer",
      method: "cash",
      lineItems: [{ productId: product.id, quantity: 1 }],
    });
    const audit = {
      tenantId: tenant.id,
      requestId: `req-cancel-${suffix}`,
      action: "order.cancelled" as const,
      targetType: "orders",
      outcome: "success" as const,
    };

    expect(await storage.deleteOrder(tenant.id, order.id, audit)).toBe(true);
    expect(
      await storage.deleteOrder(tenant.id, order.id, {
        ...audit,
        requestId: `${audit.requestId}-retry`,
      }),
    ).toBe(true);
    const events = await storage.getAuditEvents({
      global: true,
      action: "order.cancelled",
      limit: 100,
      offset: 0,
    });
    expect(events.data.filter((event) => event.targetId === String(order.id))).toHaveLength(1);
    expect(events.data.find((event) => event.targetId === String(order.id))?.action).toBe(
      "order.cancelled",
    );
    expect((await storage.getProduct(tenant.id, product.id))?.stock).toBe(3);
    expect(await storage.deleteTenant(tenant.id)).toBe(true);
  });

  it("rolls back global role and password changes when their audit cannot persist", async () => {
    const suffix = randomUUID();
    const user = await storage.createUser({
      email: `global-role-${suffix}@example.com`,
      password: "old-hash",
      name: "Global Role",
      isSuperAdmin: false,
      mustChangePassword: false,
    });

    await expect(
      storage.updateUserBySuperAdmin(
        user.id,
        {
          isSuperAdmin: true,
          hashedPassword: "new-hash",
        },
        { actorUserId: "admin", requestId: "" },
      ),
    ).rejects.toThrow(/requestId/);
    const unchanged = await storage.getUser(user.id);
    expect(unchanged).toMatchObject({ isSuperAdmin: false, password: "old-hash" });
    expect(await storage.deleteUser(user.id)).toBe(true);
  });
});
