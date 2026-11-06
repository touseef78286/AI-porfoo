/// <reference types="node" />
/**
 * Loopback API authentication helpers.
 *
 * The API is private, binds to 127.0.0.1 only, and rejects non-loopback Host
 * and Origin values. These helpers contain no route logic so they stay easy to
 * test and audit.
 */

import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Constant-time Bearer token check. */
export function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  expectedToken: string,
): boolean {
  const header = request.headers.authorization;

  if (header === undefined || !header.startsWith("Bearer ")) {
    reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Missing bearer token", requestId: request.id },
    });
    return false;
  }

  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");

  const valid =
    supplied.length === expected.length && timingSafeEqual(supplied, expected);

  if (!valid) {
    reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid bearer token", requestId: request.id },
    });
    return false;
  }

  return true;
}

/** Rejects any Host header that is not loopback. */
export function validateHost(request: FastifyRequest, reply: FastifyReply): boolean {
  const host = (request.headers.host ?? "").toLowerCase();
  const hostname = host.split(":")[0];

  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    reply.code(403).send({
      error: {
        code: "FORBIDDEN_HOST",
        message: "This API accepts loopback Host headers only",
        requestId: request.id,
      },
    });
    return false;
  }

  return true;
}

/**
 * Rejects cross-site browser requests.
 *
 * Non-browser clients send no Origin header. `null` is allowed because the
 * dashboard can be opened directly from disk during local development.
 */
export function validateOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: readonly string[],
): boolean {
  const origin = request.headers.origin;

  if (origin === undefined || origin === "null" || allowedOrigins.includes(origin)) {
    return true;
  }

  reply.code(403).send({
    error: {
      code: "FORBIDDEN_ORIGIN",
      message: `Origin "${origin}" is not allowed`,
      requestId: request.id,
    },
  });
  return false;
}

export function apiMeta(request: FastifyRequest): {
  readonly requestId: string;
  readonly generatedAt: string;
} {
  return {
    requestId: request.id,
    generatedAt: new Date().toISOString(),
  };
}
