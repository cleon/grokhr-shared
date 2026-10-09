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

test("phone is optional and omitted when absent", () => {
  const employee = employeeSchema.parse(example);
  assert.equal(employee.phone, "+1-555-010-0142");

  const { phone: _phone, ...withoutPhone } = example;
  const parsed = employeeSchema.parse(withoutPhone);
  assert.deepEqual(parsed, withoutPhone);
  assert.equal(Object.hasOwn(parsed, "phone"), false);

  assert.deepEqual(employeeCreateSchema.parse(withoutId(withoutPhone)), withoutId(withoutPhone));
  assert.deepEqual(employeeUpdateSchema.parse({ phone: example.phone }), { phone: example.phone });
  assert.throws(() => employeeSchema.parse({ ...example, phone: null }), ZodError);
  assert.throws(() => employeeCreateSchema.parse({ ...withoutId(example), phone: null }), ZodError);
  assert.throws(() => employeeUpdateSchema.parse({ phone: null }), ZodError);
});

test("zod object matches the canonical schema", () => {
  const shapeKeys = Object.keys(employeeSchema.shape);
  const optionalKeys = shapeKeys.filter((key) => employeeSchema.shape[key].isOptional());
  assert.deepEqual(optionalKeys, ["phone"]);
  assert.deepEqual(
    shapeKeys.filter((key) => !optionalKeys.includes(key)).sort(),
    [...schema.required].sort(),
  );
  assert.deepEqual(shapeKeys.sort(), Object.keys(schema.properties).sort());
  assert.equal(schema.required.includes("phone"), false);
  assert.deepEqual([...EMPLOYEE_STATUSES], schema.properties.status.enum);
  assert.deepEqual(schema.examples[0], example);
  assert.deepEqual(
    schema.$defs.EmployeeCreate.required.sort(),
    schema.required.filter((field) => field !== "id").sort(),
  );
  assert.equal(schema.$defs.EmployeeCreate.required.includes("phone"), false);
  assert.deepEqual(schema.$defs.EmployeeCreate.properties.phone, { $ref: "#/properties/phone" });
  assert.deepEqual(schema.$defs.EmployeeUpdate.properties.phone, { $ref: "#/properties/phone" });
  assert.deepEqual(schema.$defs.EmployeeUpdate.required, undefined);
});
