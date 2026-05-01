/**
 * Centralized error telemetry for DuoSpace.
 *
 * FIX #13: Replaces scattered console.error calls with a single reporting point.
 * Replace console.error / console.warn throughout the codebase with these helpers.
 *
 * In production, swap the body of `sendToBackend` to POST to your error-tracking
 * service (e.g. Sentry, LogRocket, or a custom Supabase Edge Function).
 *
 * Usage:
 *   import { logError, logWarn } from "@/lib/telemetry";
 *   logError("useDailyCall", "room creation failed", err);
 */

type Severity = "error" | "warn" | "info";

interface ErrorEvent {
  context: string;
  message: string;
  severity: Severity;
  timestamp: string;
  extra?: Record<string, unknown>;
}

/** In-memory ring buffer — last 50 events available via getRecentEvents(). */
const RING_BUFFER_SIZE = 50;
const recentEvents: ErrorEvent[] = [];

function record(event: ErrorEvent): void {
  recentEvents.push(event);
  if (recentEvents.length > RING_BUFFER_SIZE) recentEvents.shift();
}

/**
 * Returns a snapshot of recent events for debugging.
 * Call this in a crash-reporting screen or a hidden dev panel.
 */
export function getRecentEvents(): Readonly<ErrorEvent[]> {
  return [...recentEvents];
}

/**
 * Clear the in-memory event buffer (e.g. after upload to backend).
 */
export function clearEvents(): void {
  recentEvents.length = 0;
}

/**
 * Send an event to the backend telemetry sink.
 * Swap this implementation to integrate with Sentry, PostHog, etc.
 */
async function sendToBackend(event: ErrorEvent): Promise<void> {
  // TODO: Replace with real backend call when telemetry service is chosen.
  // Example:
  //   await fetch("/api/telemetry", { method: "POST", body: JSON.stringify(event) });
  void event; // no-op until backend is wired
}

function formatExtra(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, stack: err.stack?.split("\n").slice(0, 5).join("\n") };
  }
  return { raw: String(err) };
}

/** Log a non-fatal warning. Does not send to backend. */
export function logWarn(context: string, message: string, extra?: unknown): void {
  const event: ErrorEvent = {
    context,
    message,
    severity: "warn",
    timestamp: new Date().toISOString(),
    extra: formatExtra(extra),
  };
  record(event);
  if (import.meta.env.DEV) {
    console.warn(`[${context}] ${message}`, extra ?? "");
  }
}

/** Log an error and send it to the telemetry backend. */
export function logError(context: string, message: string, err?: unknown): void {
  const event: ErrorEvent = {
    context,
    message,
    severity: "error",
    timestamp: new Date().toISOString(),
    extra: formatExtra(err),
  };
  record(event);
  // Always print to console so devtools captures it.
  console.error(`[${context}] ${message}`, err ?? "");
  // Fire-and-forget — errors in the reporter must not crash the app.
  sendToBackend(event).catch(() => { /* telemetry must never throw */ });
}

/** Log an informational event (e.g. "backup started"). */
export function logInfo(context: string, message: string, extra?: unknown): void {
  const event: ErrorEvent = {
    context,
    message,
    severity: "info",
    timestamp: new Date().toISOString(),
    extra: formatExtra(extra),
  };
  record(event);
  if (import.meta.env.DEV) {
    console.info(`[${context}] ${message}`, extra ?? "");
  }
}
