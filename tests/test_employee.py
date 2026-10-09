import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as SchemaValidationError
from pydantic import ValidationError

from grokhr_shared import (
    EMPLOYEE_STATUSES,
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


def test_phone_optional_omitted_when_absent():
    with_phone = Employee.model_validate(EXAMPLE)
    assert with_phone.phone == "+1-555-010-0142"

    without = {key: value for key, value in EXAMPLE.items() if key != "phone"}
    employee = Employee.model_validate(without)
    assert employee.phone is None
    assert employee.model_dump(mode="json") == without
    assert "phone" not in employee.model_dump(mode="json")

    created = EmployeeCreate.model_validate(_without_id(without))
    assert created.model_dump(mode="json") == _without_id(without)

    patch = EmployeeUpdate.model_validate({"phone": EXAMPLE["phone"]})
    assert patch.model_dump(exclude_unset=True) == {"phone": EXAMPLE["phone"]}
    with pytest.raises(ValidationError):
        Employee.model_validate({**EXAMPLE, "phone": None})
    with pytest.raises(ValidationError):
        EmployeeCreate.model_validate({**_without_id(EXAMPLE), "phone": None})
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"phone": None})


def test_create_omits_id_and_update_is_partial():
    create_body = _without_id(EXAMPLE)
    created = EmployeeCreate.model_validate(create_body)
    assert created.model_dump(mode="json") == create_body
    with pytest.raises(ValidationError):
        EmployeeCreate.model_validate(EXAMPLE)

    patch = EmployeeUpdate.model_validate({"title": "HR Manager"})
    assert patch.model_dump(exclude_unset=True) == {"title": "HR Manager"}
    assert EmployeeUpdate.model_validate({}).model_dump(exclude_unset=True) == {}
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"title": None})
    with pytest.raises(ValidationError):
        EmployeeUpdate.model_validate({"id": EXAMPLE["id"]})


def test_model_matches_canonical_schema():
    schema = load_employee_schema()
    Draft202012Validator.check_schema(schema)

    assert set(Employee.model_fields) == set(schema["properties"])
    assert set(schema["required"]) == {
        name for name, field in Employee.model_fields.items() if field.is_required()
    }
    assert set(EmployeeCreate.model_fields) == set(schema["properties"]) - {"id"}
    assert set(schema["$defs"]["EmployeeCreate"]["required"]) == {
        name for name, field in EmployeeCreate.model_fields.items() if field.is_required()
    }
    assert "phone" not in schema["required"]
    assert list(EMPLOYEE_STATUSES) == schema["properties"]["status"]["enum"]
    assert schema["examples"][0] == EXAMPLE

    validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)
    validator.validate(EXAMPLE)
    without_phone = {key: value for key, value in EXAMPLE.items() if key != "phone"}
    validator.validate(without_phone)
    with pytest.raises(SchemaValidationError):
        validator.validate({**EXAMPLE, "phone": None})
    with pytest.raises(SchemaValidationError):
        validator.validate({**EXAMPLE, "status": "terminated"})
    with pytest.raises(SchemaValidationError):
        validator.validate({**EXAMPLE, "hireDate": "2022-02-31"})

    create_schema = _subschema(schema, "EmployeeCreate")
    assert set(create_schema["required"]) == set(schema["required"]) - {"id"}
    create_validator = Draft202012Validator(
        create_schema, format_checker=Draft202012Validator.FORMAT_CHECKER
    )
    create_validator.validate(_without_id(EXAMPLE))
    create_validator.validate(_without_id(without_phone))
    with pytest.raises(SchemaValidationError):
        create_validator.validate({**_without_id(EXAMPLE), "phone": None})
    with pytest.raises(SchemaValidationError):
        create_validator.validate(EXAMPLE)

    update_schema = _subschema(schema, "EmployeeUpdate")
    assert "required" not in update_schema
    update_validator = Draft202012Validator(update_schema)
    update_validator.validate({})
    update_validator.validate({"title": "HR Manager"})
    update_validator.validate({"phone": EXAMPLE["phone"]})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"title": None})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"phone": None})
    with pytest.raises(SchemaValidationError):
        update_validator.validate({"id": EXAMPLE["id"]})
