# grokhr-shared

Shared Employee contracts for the GrokHR demo (manage employees). Fictional HR data only — no real PII, no auth.

Both apps depend on this repo:

- The TypeScript Mantine frontend uses the npm package `@grokhr/shared`.
- The Python FastAPI backend uses the import package `grokhr_shared`.

The canonical document is [`schemas/employee.schema.json`](schemas/employee.schema.json). The TypeScript zod schemas and the Python Pydantic models mirror it.

## Breaking changes

### 1.0.0

`department` (a free-text name) is removed from `Employee`, `EmployeeCreate`, and `EmployeeUpdate`. Those types now require `departmentId` (string).

`Department` is `{ id: string, name: string }`. Keep `id` stable and change `name` when a department is renamed. Read the display name from `Department.name`.

Migrate a consumer:

1. Depend on `@grokhr/shared` / `grokhr_shared` `1.0.0`.
2. Create a `Department` for each distinct department name you already store, and keep that `id`.
3. Replace `department` with `departmentId` on employee responses, `POST` bodies, and `PATCH` bodies.
4. Remove `department` from requests. Payloads that still include it fail validation.

```ts
// before
employee.department; // "People Operations"

// after
employee.departmentId; // "dept_people_ops"
department.name; // "People Operations"
```

## Department

| Field | JSON type | Rules |
| --- | --- | --- |
| `id` | string | Stable, non-empty. Referenced by `Employee.departmentId`. |
| `name` | string | Non-empty display name. |

```json
{
  "id": "dept_people_ops",
  "name": "People Operations"
}
```

TypeScript exports `departmentSchema` and `Department`. Python exports `Department`.

## Employee

| Field | JSON type | Rules |
| --- | --- | --- |
| `id` | string | Server-assigned, non-empty. Not accepted on create or patch. |
| `firstName` | string | Non-empty |
| `lastName` | string | Non-empty |
| `email` | string (email) | Use an `@example.com` address |
| `departmentId` | string | Non-empty. `Department.id`. |
| `title` | string | Non-empty |
| `hireDate` | string (date) | ISO calendar date `YYYY-MM-DD` |
| `status` | string | `active` or `inactive` |

Unknown fields are rejected. `POST` body is `EmployeeCreate` (Employee without `id`). `PATCH` body is `EmployeeUpdate` (any subset of the create fields). Omit a field to leave it unchanged. `null` is rejected.

```json
{
  "id": "emp_example_001",
  "firstName": "Avery",
  "lastName": "Example",
  "email": "avery.example@example.com",
  "departmentId": "dept_people_ops",
  "title": "HR Generalist",
  "hireDate": "2022-03-14",
  "status": "active"
}
```

Helpers:

| TypeScript | Python | Behavior |
| --- | --- | --- |
| `displayName(employee)` | `display_name(employee)` | `"Avery Example"` |
| `isActive(employee)` | `is_active(employee)` | `true` when `status` is `active` |

Python field names stay camelCase on purpose so FastAPI emits the same JSON the frontend parses.

## TypeScript

Build once in this repo (`prepare` also builds on `npm install`):

```bash
npm install
npm run build
```

Point the web app at a packed tarball or at this checkout.

```bash
npm pack
# writes grokhr-shared-1.0.0.tgz
```

```json
{
  "dependencies": {
    "@grokhr/shared": "file:../grokhr-shared/grokhr-shared-1.0.0.tgz"
  }
}
```

A path dependency also works after `npm run build` here. npm packs `file:` dependencies and runs `prepare`, which needs this repo's devDependencies installed:

```json
{
  "dependencies": {
    "@grokhr/shared": "file:../grokhr-shared"
  }
}
```

```ts
import {
  departmentSchema,
  employeeSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  displayName,
  isActive,
  type Department,
  type Employee,
} from "@grokhr/shared";

const department: Department = departmentSchema.parse({
  id: "dept_people_ops",
  name: "People Operations",
});

const employee: Employee = employeeSchema.parse(payload);
displayName(employee);
isActive(employee);
```

The JSON Schema is exported at `@grokhr/shared/schema` (`schemas/employee.schema.json`).

`zod` is a runtime dependency. The package is ESM. `dist/` is build output and is not committed.

## Python

From the API repo, with its virtualenv active:

```bash
pip install -e ../grokhr-shared
```

Dev extras (pytest, jsonschema):

```bash
pip install -e "../grokhr-shared[dev]"
```

`requirements.txt` equivalent:

```
-e ../grokhr-shared
```

The distribution name is `grokhr_shared` (pip also accepts `grokhr-shared`). Import `grokhr_shared`.

```python
from fastapi import FastAPI
from grokhr_shared import Department, Employee, EmployeeCreate, display_name, is_active

app = FastAPI()

@app.post("/employees", response_model=Employee)
def create_employee(body: EmployeeCreate) -> Employee:
    employee = Employee(id="emp_example_002", **body.model_dump())
    display_name(employee)
    is_active(employee)
    return employee
```

`load_employee_schema()` reads `schemas/employee.schema.json`. Editable installs use the repo file. Built wheels copy it into the package.

## Tests

```bash
npm test
pip install -e ".[dev]"
pytest
```

`npm test` needs Node 18+ to run the built package. `pytest` needs Python 3.11+.
