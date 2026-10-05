"""Employee contracts for the GrokHR demo.

Field names match the JSON Schema wire format (camelCase) so a FastAPI
response model serializes to the same document the TypeScript client parses.
"""

from __future__ import annotations

import json
from datetime import date
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class EmployeeStatus(str, Enum):
    active = "active"
    inactive = "inactive"


EMPLOYEE_STATUSES = tuple(status.value for status in EmployeeStatus)


class EmployeeBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    email: EmailStr
    department: str = Field(min_length=1)
    title: str = Field(min_length=1)
    hireDate: date
    status: EmployeeStatus


class EmployeeCreate(EmployeeBase):
    """POST /employees body. The server assigns id."""


class Employee(EmployeeBase):
    id: str = Field(min_length=1)


class EmployeeUpdate(BaseModel):
    """PATCH body. Omitted fields stay unchanged. Null is rejected."""

    model_config = ConfigDict(extra="forbid")

    firstName: str | None = Field(default=None, min_length=1)
    lastName: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    department: str | None = Field(default=None, min_length=1)
    title: str | None = Field(default=None, min_length=1)
    hireDate: date | None = None
    status: EmployeeStatus | None = None

    @field_validator(
        "firstName",
        "lastName",
        "email",
        "department",
        "title",
        "hireDate",
        "status",
        mode="before",
    )
    @classmethod
    def reject_null(cls, value: object) -> object:
        # Omitted fields use the default. Explicit null is not a clear patch op.
        if value is None:
            raise ValueError("cannot be null")
        return value


def display_name(employee: EmployeeBase) -> str:
    return f"{employee.firstName} {employee.lastName}"


def is_active(employee: EmployeeBase) -> bool:
    return employee.status == EmployeeStatus.active


def employee_schema_path() -> Path:
    """Locate the canonical Employee JSON Schema.

    Editable installs keep the repo layout. Wheels copy the file into the package.
    """
    packaged = Path(__file__).resolve().parent / "schemas" / "employee.schema.json"
    if packaged.is_file():
        return packaged
    repo = Path(__file__).resolve().parents[1] / "schemas" / "employee.schema.json"
    if repo.is_file():
        return repo
    raise FileNotFoundError(
        "employee.schema.json not found. Install with `pip install -e` from the repo root."
    )


def load_employee_schema() -> dict[str, Any]:
    return json.loads(employee_schema_path().read_text(encoding="utf-8"))
