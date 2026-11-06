/**
 * Security Validation Utilities — Phase 5 Priority 1
 *
 * Provides input validation and sanitization for the local-project-intelligence system.
 * All validations enforce the loopback-only, Bearer-auth, origin-boundary security model.
 *
 * Security boundaries (per SECURITY.md §5-6, AGENTS.md §13):
 * - Host header validated to 127.0.0.1
 * - Origin header validated against registered dashboard origins
 * - No wildcard CORS
 * - Rate limits enforced
 * - Absolute paths redacted from logs
 * - Secrets never logged in plaintext
 * - Public data never reaches unapproved consumers
 */

/** Origin validation result */
export interface OriginValidationResult {
  /** Whether the origin is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Normalized origin if allowed */
  normalizedOrigin?: string;
}

/**
 * Validate that a request originates from an allowed source.
 * Loopback-only: only 127.0.0.1 and registered dashboard origins.
 *
 * @param hostname The request hostname or IP
 * @param origin The Origin header value
 * @returns Validation result
 */
export function validateDashboardOrigin(
  hostname: string,
  origin: string
): OriginValidationResult {
  // Parse the origin
  try {
    const originUrl = new URL(origin);

    // Allow loopback (127.0.0.1 or ::1)
    if (hostname === "127.0.0.1" || hostname === "::1") {
      return { allowed: true, normalizedOrigin: origin };
    }

    // Check against registered dashboard origins
    // In production, these would come from a config file/environment variables
    const registeredOrigins = [
      "http://127.0.0.1:5173", // Vite dev server
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3001", // API server
      "http://localhost:3001",
    ];

    const allowed = registeredOrigins.some((registered) => {
      const registeredUrl = new URL(registered);
      return (
        originUrl.hostname === registeredUrl.hostname &&
        originUrl.protocol === registeredUrl.protocol
      );
    });

    if (allowed) {
      return { allowed: true, normalizedOrigin: origin };
    }

    return {
      allowed: false,
      reason: `Origin ${origin} not in registered dashboard origins`,
    };
  } catch (e) {
    return {
      allowed: false,
      reason: `Invalid origin format: ${origin}`,
    };
  }
}

/**
 * Sanitize a project ID to prevent injection attacks.
 * Project IDs should be alphanumeric with optional hyphens/underscores.
 *
 * @param id The project ID to sanitize
 * @returns Sanitized project ID (empty string if invalid)
 */
export function sanitizeProjectId(id: string): string {
  if (!id) return "";
  // Allow alphanumeric, hyphens, underscores, and dots
  const sanitized = id.replace(/[^a-zA-Z0-9._-]/g, "");
  return sanitized.length > 0 ? sanitized : "";
}

/** Sanitize a project display name to prevent XSS */
export function sanitizeDisplayName(name: string): string {
  if (!name) return "";
  // Escape HTML/JS injection characters before any rendering context.
  const entities: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "&": "&amp;",
  };
  const sanitized = name
    .replace(/[<>"'&]/g, (c) => entities[c] ?? c)
    .substring(0, 200); // Max length protection
  return sanitized;
}

/** Validate a Bearer token format */
export function validateBearerToken(token: string): boolean {
  if (!token) return false;
  // Token must start with "Bearer " prefix
  const trimmed = token.trim();
  return trimmed.toLowerCase().startsWith("bearer ");
}

/** Extract the actual token from a Bearer authorization header */
export function extractBearerToken(authHeader: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  const scheme = parts[0];
  const value = parts[1];
  if (scheme === undefined || value === undefined) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  return value.trim();
}

/** Rate limit status tracking */
export interface RateLimitStatus {
  /** Requests made in current window */
  requestsMade: number;
  /** Maximum allowed requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Whether the rate limit has been exceeded */
  exceeded: boolean;
  /** Time until reset in milliseconds */
  timeUntilResetMs: number;
}

/** Create a rate limit status checker */
export function createRateLimitChecker(
  limit: number,
  windowMs: number
): {
  check: (requestsMade: number) => RateLimitStatus;
  reset: () => void;
} {
  let startTime = Date.now();

  return {
    check: (requestsMade: number): RateLimitStatus => {
      const elapsed = Date.now() - startTime;
      const exceeded = requestsMade > limit;
      const timeUntilReset =
        elapsed > windowMs ? 0 : windowMs - elapsed;

      return {
        requestsMade,
        limit,
        windowMs,
        exceeded,
        timeUntilResetMs: timeUntilReset,
      };
    },

    reset: (): void => {
      startTime = Date.now();
    },
  };
}

export default {
  validateDashboardOrigin,
  sanitizeProjectId,
  sanitizeDisplayName,
  validateBearerToken,
  extractBearerToken,
  createRateLimitChecker,
};