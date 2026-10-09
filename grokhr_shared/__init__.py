"""Shared Employee contracts for the GrokHR demo."""

from grokhr_shared.employee import (
    EMPLOYEE_STATUSES,
    Department,
    Employee,
    EmployeeCreate,
    EmployeeStatus,
    EmployeeUpdate,
    display_name,
    employee_schema_path,
    is_active,
    load_employee_schema,
)

__all__ = [
    "EMPLOYEE_STATUSES",
    "Department",
    "Employee",
    "EmployeeCreate",
    "EmployeeStatus",
    "EmployeeUpdate",
    "display_name",
    "employee_schema_path",
    "is_active",
    "load_employee_schema",
]

__version__ = "1.0.0"
