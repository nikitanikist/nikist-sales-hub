
# Fully Customizable Cohort Batches System

## Understanding Your Requirement

Currently, the system has pre-seeded cohort types ("Insider Crypto Club", "Future Mentorship", "High Future") for ALL organizations, including new ones like "Test org". This is incorrect because:

1. These specific cohort names belong to **Nikist organization** only
2. New organizations should start with **zero cohorts** and create their own
3. Organizations need the ability to **create, name, and manage** their own cohort types
4. The sidebar should dynamically show only cohorts belonging to the current organization

## What Needs to Change

### Current State (Problem)
- Migration seeded 3 default cohorts for ALL organizations
- `cohort_types` table has hardcoded slugs mapping to fixed routes (`/batches`, `/futures-mentorship`, `/high-future`)
- Three separate database tables exist: `batches`, `futures_mentorship_students`, `high_future_students`
- AppLayout shows default cohorts as fallback

### Target State (Solution)
- New organizations start with **0 cohort types**
- Sidebar shows "Cohort Batches" with a single option: "**+ Create Cohort**" when empty
- Once a cohort is created, it appears in the sidebar submenu
- Each cohort type routes to a **unified cohort page** that works with any organization's custom cohorts
- Full CRUD for cohort types (create, rename, reorder, delete)

## Implementation Plan

### Phase 1: Database Cleanup & Schema Enhancement

**1.1 Delete seeded cohort types for Test org**
Remove the pre-seeded cohort_types entries for the new "Test org" organization, leaving only Nikist's cohorts intact.

**1.2 Create unified cohort batches table**
Create a new `cohort_batches` table that stores batches for ANY cohort type:

```text
cohort_batches
├── id (uuid)
├── cohort_type_id (uuid) → references cohort_types
├── organization_id (uuid)
├── name (text) - e.g., "Batch 1", "January 2024"
├── start_date / event_dates
├── is_active (boolean)
├── created_at, updated_at
```

**1.3 Create unified cohort students table**
Create a `cohort_students` table that works for all cohort types:

```text
cohort_students
├── id (uuid)
├── cohort_batch_id (uuid) → references cohort_batches
├── organization_id (uuid)
├── lead_id (uuid)
├── conversion_date, offer_amount, cash_received, due_amount
├── status, notes, next_follow_up_date, pay_after_earning
├── ... (all existing student fields)
```

**1.4 Create unified cohort EMI payments table**
```text
cohort_emi_payments
├── id (uuid)
├── student_id (uuid) → references cohort_students
├── organization_id (uuid)
├── emi_number, amount, payment_date
├── ... (all existing EMI fields)
```

### Phase 2: Data Migration for Nikist

Migrate existing data from the three separate tables to the unified structure:
- `batches` → `cohort_batches` (linked to "Insider Crypto Club" cohort_type)
- `futures_mentorship_students` → `cohort_students`
- `high_future_students` → `cohort_students`
- Corresponding EMI payments

### Phase 3: Frontend - Unified Cohort Page

**3.1 Create `/cohorts/:cohortSlug` dynamic route**
A single page component that:
- Takes `cohortSlug` from URL params
- Looks up the cohort type by slug for the current organization
- Displays batches and students specific to that cohort type
- Reuses the existing batch management UI (tabs, insights, student table)

**3.2 Create "Manage Cohort Types" admin page**
Add a management interface (accessible from sidebar or settings) where admins can:
- View all cohort types for their organization
- Create new cohort type (name, icon, display order)
- Rename existing cohort types
- Reorder cohort types in the sidebar
- Delete cohort types (with confirmation if it has data)

**3.3 Update AppLayout.tsx sidebar**
Modify the dynamic cohort children logic:
- If organization has 0 cohort types: Show single item "**+ Create Cohort**" that opens the creation dialog/page
- If organization has cohort types: Show them as submenu items with routes like `/cohorts/my-custom-cohort`
- Each item links to the unified cohort page

### Phase 4: Update Routing

**4.1 Add dynamic cohort route in App.tsx**
```
/cohorts/:cohortSlug → UnifiedCohortPage
/cohorts/manage → CohortTypesManagement (admin only)
```

**4.2 Maintain backward compatibility for Nikist**
Keep the existing routes (`/batches`, `/futures-mentorship`, `/high-future`) as aliases that redirect to the new unified routes, so bookmarks and muscle memory continue to work.

### Phase 5: Permission System Updates

**5.1 Dynamic permissions for custom cohorts**
Since cohort types are now fully dynamic, the permission system needs adjustment:
- Add a general `cohort_batches` permission for access to the entire Cohort Batches section
- Individual cohort types can optionally have fine-grained permissions stored in a new column or relation

### Phase 6: Cleanup (Optional, After Validation)

Once the unified system is validated:
- Archive or remove the old separate tables (`batches`, `futures_mentorship_students`, etc.)
- Update any RPC functions to work with the new unified tables

## Technical Considerations

### Why a Unified Table Structure?
- **Scalability**: Organizations can create unlimited cohort types without needing new database tables
- **Maintainability**: One set of queries, one page component, one set of RPC functions
- **Flexibility**: New organizations aren't constrained to the 3 original cohort types

### Backward Compatibility
- Nikist's existing data will be migrated to the new structure
- Existing routes continue to work via redirects
- No data loss for current operations

## Summary of Changes

| Area | Current | New |
|------|---------|-----|
| Cohort Types | Pre-seeded for all orgs | Created by each org |
| Tables | 3 separate sets per type | 1 unified set |
| Routes | `/batches`, `/futures-mentorship`, `/high-future` | `/cohorts/:slug` |
| Sidebar | Hardcoded 3 items or fallback | Dynamic from `cohort_types` |
| Empty State | Shows default 3 | Shows "Create Cohort" CTA |
