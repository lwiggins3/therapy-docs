# @therapy-docs/audit

Typed audit-event emitter satisfying the requirement that every access to patient transcript
content be logged and retained.

## Usage

```ts
import { AuditLogger } from "@therapy-docs/audit";

const auditLogger = new AuditLogger({ bigqueryDataset: process.env.BIGQUERY_AUDIT_DATASET! });

await auditLogger.record({
  actorId: therapist.id,
  action: "transcript.view",
  resourceType: "transcript",
  resourceId: transcript.id,
  patientId: transcript.patientId,
  sourceIp: request.ip,
});
```

## Where this must be called

- `apps/api` — whenever a therapist views transcript content or exports it.
- `apps/worker` — whenever the ingestion or recommendation pipeline reads transcript text
  (OCR/extraction output) or sends it to `packages/llm-client`. LLM processing of a transcript
  is itself an access and must be logged (`transcript.llm_process`).

## Design notes

- Postgres `audit_events` is insert-only by convention — never call `db.auditEvent.update()` or
  `.delete()` anywhere in the codebase.
- Every write also streams to BigQuery so the audit trail survives independently of the primary
  database's backup/retention policy, satisfying the multi-year retention HIPAA expects.
- IAP access logs (see `docs/hipaa-compliance.md`) are a second, infrastructure-level audit
  trail that complements this application-level one — IAP logs "who reached the app", this
  logs "what patient data they touched once inside."
