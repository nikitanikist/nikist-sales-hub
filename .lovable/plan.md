

## Update Closer Assignments for Two Students

### Current State (Insider Crypto Club — Batch 4)

| Student | Phone | Current Closer |
|---------|-------|---------------|
| Mudit Manglik | 9720003371 | **None** (not assigned) |
| Arun Kumar | 7060808239 | **None** (not assigned) |

### Target State

| Student | Phone | New Closer |
|---------|-------|------------|
| Mudit Manglik | 9720003371 | **Aadesh** |
| Arun Kumar | 7060808239 | **Dipanshu** |

### Implementation

Two simple database updates on the `cohort_students` table:

1. Set `closer_id` to Aadesh's ID for Mudit Manglik's record
2. Set `closer_id` to Dipanshu's ID for Arun Kumar's record

No schema changes, no edge function updates, no UI changes required. Just two UPDATE statements via a database migration.

