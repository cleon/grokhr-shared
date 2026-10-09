import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ZodError } from "zod";

import {
  EMPLOYEE_STATUSES,
  departmentSchema,
  displayName,
  employeeCreateSchema,
  employeeSchema,
  employeeUpdateSchema,
  isActive,
} from "../dist/index.js";

const example = JSON.parse(
  readFileSync(new URL("../fixtures/employee.example.json", import.meta.url), "utf8"),
);
const department = JSON.parse(
  readFileSync(new URL("../fixtures/department.example.json", import.meta.url), "utf8"),
);
const schema = JSON.parse(
  readFileSync(new URL("../schemas/employee.schema.json", import.meta.url), "utf8"),
);

function withDepartmentName(employee) {
  const { departmentId: _departmentId, ...rest } = employee;
  return { ...rest, department: "People Operations" };
}

function withoutId(employee) {
  const { id: _id, ...create } = employee;
  return create;
}

test("parses a department", () => {
  assert.deepEqual(departmentSchema.parse(department), department);
  assert.equal(department.id, example.departmentId);
  assert.throws(() => departmentSchema.parse({ ...department, id: "" }), ZodError);
  assert.throws(() => departmentSchema.parse({ ...department, name: "" }), ZodError);
  assert.throws(() => departmentSchema.parse({ ...department, code: "PO" }), ZodError);
});

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
  assert.throws(() => employeeSchema.parse({ ...example, departmentId: "" }), ZodError);
  assert.throws(() => employeeSchema.parse(withDepartmentName(example)), ZodError);
});

test("create omits id and update is a partial", () => {
  const create = withoutId(example);
  assert.deepEqual(employeeCreateSchema.parse(create), create);
  assert.throws(() => employeeCreateSchema.parse(example), ZodError);

  assert.deepEqual(employeeUpdateSchema.parse({ title: "HR Manager" }), {
    title: "HR Manager",
  });
  assert.deepEqual(employeeUpdateSchema.parse({ departmentId: department.id }), {
    departmentId: department.id,
  });
  assert.deepEqual(employeeUpdateSchema.parse({}), {});
  assert.throws(() => employeeUpdateSchema.parse({ title: null }), ZodError);
  assert.throws(() => employeeUpdateSchema.parse({ departmentId: null }), ZodError);
  assert.throws(() => employeeUpdateSchema.parse({ id: example.id }), ZodError);
  assert.throws(() => employeeUpdateSchema.parse({ department: "People Operations" }), ZodError);
  assert.throws(() => employeeCreateSchema.parse(withDepartmentName(create)), ZodError);
});

test("zod object matches the canonical schema", () => {
  assert.deepEqual(Object.keys(employeeSchema.shape).sort(), [...schema.required].sort());
  assert.equal(schema.properties.department, undefined);
  assert.equal(schema.properties.departmentId.type, "string");
  assert.deepEqual([...EMPLOYEE_STATUSES], schema.properties.status.enum);
  assert.deepEqual(schema.examples[0], example);
  assert.deepEqual(Object.keys(departmentSchema.shape).sort(), [...schema.$defs.Department.required].sort());
  assert.deepEqual(schema.$defs.Department.examples[0], department);
  assert.deepEqual(
    schema.$defs.EmployeeCreate.required.sort(),
    schema.required.filter((field) => field !== "id").sort(),
  );
  assert.deepEqual(schema.$defs.EmployeeUpdate.required, undefined);
});
