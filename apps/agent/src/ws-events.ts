/// <reference types="node" />
/**
 * WebSocket events for Gate 10 — Project Publication and Advanced Features.
 *
 * Provides real-time event streaming for scanner progress, project updates,
 * and publication changes over the loopback-only API connection.
 *
 * Security boundaries (per SECURITY.md §5-6, AGENTS.md §13):
 * - WSS handshake validates Host header to 127.0.0.1
 * - Origin header validated against registered dashboard origins
 * - No secret values or absolute paths in event data
 * - Event backlog is bounded
 * - Client must tolerate reconnects; events are not source of truth
 * - On reconnect, client re-fetches current state
 */

import { EventEmitter } from "events";

/** Event types published by the scanner and publication system. */
export type WsEventType =
  | "agent.ready"
  | "scanner.state"
  | "scan.started"
  | "scan.progress"
  | "scan.completed"
  | "scan.failed"
  | "project.created"
  | "project.updated"
  | "project.missing"
  | "project.restored"
  | "relationship.changed"
  | "publication.changed"
  | "root.added"
  | "root.removed"
  | "reconciliation.started"
  | "reconciliation.completed";

/** WebSocket event envelope — never contains raw manifests or secrets. */
export interface WsEvent {
  readonly type: WsEventType;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly data: Record<string, unknown>;
}

/** Event backlog bound — maximum number of events to retain. */
export const EVENT_BACKLOG_MAX = 100;

/** In-memory event emitter for WebSocket broadcasting.
 * In production, this would use a Redis pub/sub or similar.
 */
export const wsEventEmitter = new (class extends EventEmitter {
  private backlog: Record<string, unknown>[] = [];

  emitEvent(event: { type: WsEventType; data: Record<string, unknown> }): boolean {
    if (this.backlog.length >= EVENT_BACKLOG_MAX) {
      this.backlog.shift();
    }
    this.backlog.push(event.data);
    return super.emit(event.type, event);
  }

  getBacklog(): Record<string, unknown>[] {
    return this.backlog;
  }

  clearBacklog(): void {
    this.backlog = [];
  }
})();

/** Publish a scanner state event. */
export function publishScannerState(event: {
  type: WsEventType;
  data: Record<string, unknown>;
}): void {
  wsEventEmitter.emitEvent({ type: "scanner.state", data: event.data });
}

/** Publish a scan progress event. */
export function publishScanProgress(event: {
  scanId: string;
  progress: number;
  message: string;
  etaSeconds: number;
}): void {
  wsEventEmitter.emitEvent({ type: "scan.progress", data: { scanId: event.scanId, progress: event.progress, message: event.message, etaSeconds: event.etaSeconds } });
}

/** Publish a project created event. */
export function publishProjectCreated(event: {
  projectId: string;
  displayName: string;
  ecosystem: string;
  detectionState: string;
}): void {
  wsEventEmitter.emitEvent({ type: "project.created", data: { projectId: event.projectId, displayName: event.displayName, ecosystem: event.ecosystem, detectionState: event.detectionState } });
}

/** Publish a publication changed event. */
export function publishPublicationChanged(event: {
  projectId: string;
  state: "pending" | "approved" | "rejected" | "snapshot";
  approvedFields?: string[];
}): void {
  wsEventEmitter.emitEvent({ type: "publication.changed", data: { projectId: event.projectId, state: event.state, approvedFields: event.approvedFields } });
}