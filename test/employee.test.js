import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ZodError } from "zod";

import {
  EMPLOYEE_STATUSES,
  displayName,
  employeeCreateSchema,
  employeeSchema,
  employeeUpdateSchema,
  isActive,
} from "../dist/index.js";

const example = JSON.parse(
  readFileSync(new URL("../fixtures/employee.example.json", import.meta.url), "utf8"),
);
const schema = JSON.parse(
  readFileSync(new URL("../schemas/employee.schema.json", import.meta.url), "utf8"),
);

function withoutId(employee) {
  const { id: _id, ...create } = employee;
  return create;
}

test("parses the shared example and helpers", () => {
  const employee = employeeSchema.parse(example);
  assert.equal(displayName(employee), "Avery Example");
  assert.equal(isActive(employee), true);
  assert.deepEqual(employee, example);
});

test("isActive is false for inactive employees", () => {
  const employee = employeeSchema.parse({ ...example, status: "inactive" });
  assert.equal(isActive(employee), false);
});

test("rejects invalid employee documents", () => {
  assert.throws(() => employeeSchema.parse({ ...example, status: "terminated" }), ZodError);
  assert.throws(() => employeeSchema.parse({ ...example, hireDate: "2022-02-31" }), ZodError);
  assert.throws(() => employeeSchema.parse({ ...example, hireDate: "03/14/2022" }), ZodError);
  assert.throws(() => employeeSchema.parse({ ...example, email: "not-an-email" }), ZodError);
  assert.throws(() => employeeSchema.parse({ ...example, firstName: "" }), ZodError);
  assert.throws(() => employeeSchema.parse({ ...example, nickname: "Ace" }), ZodError);
});

test("create omits id and update is a partial", () => {
  const create = withoutId(example);
  assert.deepEqual(employeeCreateSchema.parse(create), create);
  assert.throws(() => employeeCreateSchema.parse(example), ZodError);

  assert.deepEqual(employeeUpdateSchema.parse({ title: "HR Manager" }), {
    title: "HR Manager",
  });
  assert.deepEqual(employeeUpdateSchema.parse({}), {});
  assert.throws(() => employeeUpdateSchema.parse({ title: null }), ZodError);
  assert.throws(() => employeeUpdateSchema.parse({ id: example.id }), ZodError);
});

test("zod object matches the canonical schema", () => {
  assert.deepEqual(Object.keys(employeeSchema.shape).sort(), [...schema.required].sort());
  assert.deepEqual([...EMPLOYEE_STATUSES], schema.properties.status.enum);
  assert.deepEqual(schema.examples[0], example);
  assert.deepEqual(
    schema.$defs.EmployeeCreate.required.sort(),
    schema.required.filter((field) => field !== "id").sort(),
  );
  assert.deepEqual(schema.$defs.EmployeeUpdate.required, undefined);
});
