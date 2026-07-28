# modules/data

Provisions every place PHI is stored at rest:

- Cloud SQL for PostgreSQL, with the `cloudsql.enable_pgvector` database flag on and CMEK
  encryption via `modules/data`'s own Cloud KMS key.
- Two GCS buckets (`documents`, `transcripts`), CMEK-encrypted, uniform bucket-level access,
  versioning on.
- A BigQuery dataset for the long-term, append-only audit log mirror (see
  `packages/audit`).
- A Cloud KMS key ring/key used for CMEK across the above.

## Outputs

- `cloud_sql_connection_name`, `documents_bucket_name`, `transcripts_bucket_name`,
  `audit_dataset_id` — consumed by `modules/compute` to wire up Cloud Run env vars, and useful
  for local `.env` setup.

## Notes

- pgvector index type (`ivfflat` vs `hnsw`) and dimensions are chosen in a Prisma migration
  (`packages/db`), not here — this module only ensures the extension is enabled on the instance.
- Retention: BigQuery dataset should be configured with a partition expiration matching
  whatever retention period the BAA and clinic's policy require (7 years is a common HIPAA
  baseline) — not yet set here, add once that period is confirmed.
