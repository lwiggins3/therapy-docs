import { BigQuery } from "@google-cloud/bigquery";
import { db } from "@therapy-docs/db";
import type { AuditAction } from "@therapy-docs/shared-types";

export interface RecordAuditEventInput {
  actorId: string;
  action: AuditAction;
  resourceType: "transcript" | "document";
  resourceId: string;
  patientId?: string;
  sourceIp?: string;
}

/**
 * Records every access to patient transcript (or library document) content. Required by
 * requirement (e): "logging of what has accessed patient transcripts must be retained."
 *
 * Writes go to two places:
 *   1. Postgres `audit_events` — insert-only, queried by the app for "who accessed this
 *      transcript" views.
 *   2. BigQuery `audit_logs` dataset — append-only, long-term (7-year) immutable retention,
 *      independent of the primary database's lifecycle.
 *
 * Call this from apps/api and apps/worker at every point transcript content is read, written,
 * or handed to an LLM — never only at the API boundary, since the worker's ingestion/
 * recommendation pipelines also touch transcript content directly.
 */
export class AuditLogger {
  private readonly bigquery: BigQuery;
  private readonly dataset: string;

  constructor(options: { bigqueryDataset: string }) {
    this.bigquery = new BigQuery();
    this.dataset = options.bigqueryDataset;
  }

  async record(event: RecordAuditEventInput): Promise<void> {
    const row = {
      actorId: event.actorId,
      action: event.action.replace(/\./g, "_"),
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      patientId: event.patientId ?? null,
      sourceIp: event.sourceIp ?? null,
    };

    await db.auditEvent.create({
      data: {
        actorId: row.actorId,
        action: row.action as never, // Prisma enum values use underscores, see schema.prisma
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        patientId: row.patientId,
        sourceIp: row.sourceIp,
      },
    });

    // TODO: batch/stream these instead of one insert per event once volume warrants it
    // (e.g. buffer + Pub/Sub -> scheduled BigQuery load, rather than a direct insert per call).
    await this.bigquery
      .dataset(this.dataset)
      .table("audit_events")
      .insert([{ ...row, occurredAt: new Date().toISOString() }]);
  }
}
