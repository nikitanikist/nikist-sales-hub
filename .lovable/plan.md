

# Update Closer Assignment for 3 Students in Batch 5

## What
Set `closer_id` to Akansha (`ca1af8e6-6b99-4a5d-8402-e50c806c6de3`) for three cohort_students records in Insider Crypto Club Batch 5.

## How
Single data update (no code changes):

```sql
UPDATE cohort_students
SET closer_id = 'ca1af8e6-6b99-4a5d-8402-e50c806c6de3'
WHERE id IN (
  'c7734194-d25e-42dd-b3e9-cd10721a4a44',  -- Hamesh Kumar
  '38d2b854-46c4-487d-99a8-0c3353eedd1f',  -- Varun Nayyar
  '7d13fc0c-8ce6-44c7-922c-aa3f9594a2a0'   -- Syed Adnan
);
```

No file changes required. This is a data-only operation.

