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

function withoutPreferredName(employee) {
  const { preferredName: _preferredName, ...rest } = employee;
  return rest;
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

test("preferredName is optional, trimmed, and non-blank", () => {
  const omitted = withoutPreferredName(example);
  const employee = employeeSchema.parse(omitted);
  assert.equal(employee.preferredName, undefined);
  assert.deepEqual(employee, omitted);

  assert.deepEqual(employeeSchema.parse({ ...example, preferredName: "  Ave  " }), {
    ...example,
    preferredName: "Ave",
  });
  assert.equal(
    employeeCreateSchema.parse({ ...withoutId(omitted), preferredName: " Ave " }).preferredName,
    "Ave",
  );
  assert.equal(employeeCreateSchema.parse(withoutId(omitted)).preferredName, undefined);
  assert.deepEqual(employeeUpdateSchema.parse({ preferredName: "  Ave  " }), {
    preferredName: "Ave",
  });

  for (const blank of ["", "   "]) {
    assert.throws(() => employeeSchema.parse({ ...example, preferredName: blank }), ZodError);
    assert.throws(
      () => employeeCreateSchema.parse({ ...withoutId(example), preferredName: blank }),
      ZodError,
    );
    assert.throws(() => employeeUpdateSchema.parse({ preferredName: blank }), ZodError);
  }

  assert.throws(() => employeeSchema.parse({ ...example, preferredName: null }), ZodError);
  assert.throws(
    () => employeeCreateSchema.parse({ ...withoutId(example), preferredName: null }),
    ZodError,
  );
  assert.throws(() => employeeUpdateSchema.parse({ preferredName: null }), ZodError);

  assert.equal(schema.properties.preferredName.minLength, 1);
  assert.equal(schema.required.includes("preferredName"), false);
  assert.equal(schema.$defs.EmployeeCreate.required.includes("preferredName"), false);
  assert.ok(schema.$defs.EmployeeCreate.properties.preferredName);
  assert.ok(schema.$defs.EmployeeUpdate.properties.preferredName);
  assert.equal(schema.$defs.EmployeeUpdate.required, undefined);
});

test("zod object matches the canonical schema", () => {
  assert.deepEqual(Object.keys(employeeSchema.shape).sort(), Object.keys(schema.properties).sort());
  assert.deepEqual(
    [...schema.required].sort(),
    Object.keys(schema.properties)
      .filter((field) => field !== "preferredName")
      .sort(),
  );
  assert.deepEqual([...EMPLOYEE_STATUSES], schema.properties.status.enum);
  assert.deepEqual(schema.examples[0], example);
  assert.deepEqual(
    schema.$defs.EmployeeCreate.required.sort(),
    schema.required.filter((field) => field !== "id").sort(),
  );
  assert.deepEqual(schema.$defs.EmployeeUpdate.required, undefined);
});
