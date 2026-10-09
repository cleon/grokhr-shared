# Add optional phone across shared, API, and web

Employees can store an optional work phone number. Ship the contract, persistence, and form in one package.

## Steps

1. **Shared contract** — Add optional `phone` on the Employee schema and matching TypeScript / Python models.
   - `schemas/employee.schema.json`
   - `src/employee.ts`
   - `grokhr_shared/employee.py`
   - `fixtures/employee.example.json`
2. **API persistence** — Accept and store `phone` on create/update; include it on reads used by the directory.
   - `sql/schema.sql`
   - `app/db.py`
   - `grokhr_shared.py` (vendored shared types if present)
3. **Web form** — Optional Phone field on the employee drawer; send and display phone through the employees API client.
   - `src/types/employee.ts`
   - `src/lib/employeeForm.ts`
   - `src/components/EmployeeDrawer.tsx`
   - `src/api/http.ts`
4. **Directory column** — Show phone on the main employee table so the roster matches the drawer.

## Out of scope

- Phone validation beyond basic string storage
- SMS or dialer integrations
- Migrating historical employee records with invented numbers

## Depends on

- Shared PR merges before or with API so the API does not invent a divergent phone shape
- API PR merges before or with web so the form does not post a field the API drops
