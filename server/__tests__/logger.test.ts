import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, requestIdMiddleware } from "../logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request correlation", () => {
  it("preserves a bounded safe request ID", () => {
    const req = { headers: { "x-request-id": "gateway:request-123" } } as Request;
    const setHeader = vi.fn();
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, { setHeader } as unknown as Response, next);

    expect(req.requestId).toBe("gateway:request-123");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "gateway:request-123");
    expect(next).toHaveBeenCalledOnce();
  });

  it("replaces an unsafe request ID instead of reflecting it", () => {
    const req = { headers: { "x-request-id": "invalid request id\n" } } as Request;
    const setHeader = vi.fn();

    requestIdMiddleware(req, { setHeader } as unknown as Response, vi.fn());

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.requestId).not.toContain("invalid");
  });
});

describe("structured logging", () => {
  it("redacts sensitive nested values", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("safe event", {
      requestId: "request-1",
      password: "must-not-appear",
      nested: { authorization: "must-not-appear-either" },
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0][0])) as Record<string, unknown>;
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.nested).toEqual({ authorization: "[REDACTED]" });
    expect(String(infoSpy.mock.calls[0][0])).not.toContain("must-not-appear");
  });
});
