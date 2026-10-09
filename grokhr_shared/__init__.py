"""Shared Employee contracts for the GrokHR demo."""

from grokhr_shared.employee import (
    EMPLOYEE_STATUSES,
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
    "Employee",
    "EmployeeCreate",
    "EmployeeStatus",
    "EmployeeUpdate",
    "display_name",
    "employee_schema_path",
    "is_active",
    "load_employee_schema",
]

__version__ = "0.2.0"
