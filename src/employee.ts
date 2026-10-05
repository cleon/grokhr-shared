import { z } from "zod";

/** Wire values for Employee.status. Matches the JSON Schema enum. */
export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;

export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES);

export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

export const employeeSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().min(1),
    preferredName: z.string().trim().min(1).optional(),
    lastName: z.string().min(1),
    email: z.string().email(),
    department: z.string().min(1),
    title: z.string().min(1),
    hireDate: z.string().date(),
    status: employeeStatusSchema,
  })
  .strict();

export type Employee = z.infer<typeof employeeSchema>;

/** POST body. The server assigns id. */
export const employeeCreateSchema = employeeSchema.omit({ id: true }).strict();

export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;

/** PATCH body. Omitted fields stay unchanged. Null is rejected. */
export const employeeUpdateSchema = employeeCreateSchema.partial().strict();

export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;

export function displayName(
  employee: Pick<Employee, "firstName" | "lastName">,
): string {
  return `${employee.firstName} ${employee.lastName}`;
}

export function isActive(employee: Pick<Employee, "status">): boolean {
  return employee.status === "active";
}
