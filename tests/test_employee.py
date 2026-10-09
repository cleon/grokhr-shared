import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as SchemaValidationError
from pydantic import ValidationError

from grokhr_shared import (
    EMPLOYEE_STATUSES,
    Department,
    Employee,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeStatus,
    display_name,
    is_active,
    load_employee_schema,
)

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = json.loads((ROOT / "fixtures" / "employee.example.json").read_text(encoding="utf-8"))
DEPARTMENT = json.loads((ROOT / "fixtures" / "department.example.json").read_text(encoding="utf-8"))


def _with_department_name(employee: dict) -> dict:
    legacy = {key: value for key, value in employee.items() if key != "departmentId"}
    legacy["department"] = "People Operations"
    return legacy


def _without_id(employee: dict) -> dict:
    return {key: value for key, value in employee.items() if key != "id"}


def _subschema(schema: dict, name: str) -> dict:
    """Copy a $def and inline #/properties refs so it validates on its own."""
    sub = json.loads(json.dumps(schema["$defs"][name]))
    for prop_name, prop in sub["properties"].items():
        ref = prop.get("$ref", "")
        prefix = "#/properties/"
        assert ref.startswith(prefix)
        sub["properties"][prop_name] = schema["properties"][ref.removeprefix(prefix)]
    return sub


def test_department_round_trip():
    department = Department.model_validate(DEPARTMENT)
    assert department.model_dump(mode="json") == DEPARTMENT
    assert department.id == EXAMPLE["departmentId"]
    with pytest.raises(ValidationError):
        Department.model_validate({**DEPARTMENT, "id": ""})
    with pytest.raises(ValidationError):
        Department.model_validate({**DEPARTMENT, "name": ""})
    with pytest.raises(ValidationError):
        Department.model_validate({**DEPARTMENT, "code": "PO"})


def test_example_round_trip_and_helpers():
    employee = Employee.model_validate(EXAMPLE)
    assert employee.model_dump(mode="json") == EXAMPLE
    assert display_name(employee) == "Avery Example"
    assert is_active(employee) is True


def test_inactive_helper():
    employee = Employee.model_validate({**EXAMPLE, "status": "inactive"})
    assert employee.status is EmployeeStatus.inactive
    assert is_active(employee) is False


def test_rejects_invalid_employee_documents():
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "status": "terminated"})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "hireDate": "2022-02-31"})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "hireDate": "03/14/2022"})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "email": "not-an-email"})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "firstName": ""})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "nickname": "Ace"})
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "departmentId": ""})
    with pytest.raises(ValidationError):
        Employee.model_validate(_with_department_name(EXAMPLE))


def test_create_omits_id_and_update_is_partial():
    create_body = _without_id(EXAMPLE)
    created = EmployeeCreate.model_validate(create_body)
    assert created.model_dump(mode="json") == create_body
    with pytest.raises(ValidationError):
        EmployeeCreate.model_validate(EXAMPLE)

    patch = EmployeeUpdate.model_validate({"title": "HR Manager"})
    assert patch.model_dump(exclude_unset=True) == {"title": "HR Manager"}
    department_patch = EmployeeUpdate.model_validate({"departmentId": DEPARTMENT["id"]})
    assert department_patch.model_dump(exclude_unset=True) == {"departmentId": DEPARTMENT["id"]}
    assert EmployeeUpdate.model_validate({}).model_dump(exclude_unset=True) == {}
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"title": None})
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"departmentId": None})
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"id": EXAMPLE["id"]})
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"department": "People Operations"})
    with pytest.raises(ValidationError):
        EmployeeCreate.model_validate(_with_department_name(create_body))


def test_model_matches_canonical_schema():
    schema = load_employee_schema()
    Draft202012Validator.check_schema(schema)

    assert set(Employee.model_fields) == set(schema["required"])
    assert set(EmployeeCreate.model_fields) == set(schema["required"]) - {"id"}
    assert list(EMPLOYEE_STATUSES) == schema["properties"]["status"]["enum"]
    assert "department" not in schema["properties"]
    assert schema["properties"]["departmentId"]["type"] == "string"
    assert schema["examples"][0] == EXAMPLE

    department_schema = schema["$defs"]["Department"]
    assert set(Department.model_fields) == set(department_schema["required"])
    assert department_schema["examples"][0] == DEPARTMENT
    department_validator = Draft202012Validator(
        department_schema, format_checker=Draft202012Validator.FORMAT_CHECKER
    )
    department_validator.validate(DEPARTMENT)
    with pytest.raises(SchemaValidationError):
        department_validator.validate({**DEPARTMENT, "name": ""})

    validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)
    validator.validate(EXAMPLE)
    with pytest.raises(SchemaValidationError):
        validator.validate({**EXAMPLE, "status": "terminated"})
    with pytest.raises(SchemaValidationError):
        validator.validate({**EXAMPLE, "hireDate": "2022-02-31"})
    with pytest.raises(SchemaValidationError):
        validator.validate(_with_department_name(EXAMPLE))

    create_schema = _subschema(schema, "EmployeeCreate")
    assert set(create_schema["required"]) == set(schema["required"]) - {"id"}
    create_validator = Draft202012Validator(
        create_schema, format_checker=Draft202012Validator.FORMAT_CHECKER
    )
    create_validator.validate(_without_id(EXAMPLE))
    with pytest.raises(SchemaValidationError):
        create_validator.validate(EXAMPLE)

    update_schema = _subschema(schema, "EmployeeUpdate")
    assert "required" not in update_schema
    update_validator = Draft202012Validator(update_schema)
    update_validator.validate({})
    update_validator.validate({"title": "HR Manager"})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"title": None})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"id": EXAMPLE["id"]})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"department": "People Operations"})
    update_validator.validate({"departmentId": DEPARTMENT["id"]})
