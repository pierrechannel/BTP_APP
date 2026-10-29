from importlib import import_module

import pytest
from django.apps import apps

from apps.accounts.models import Tenant
from apps.common.identifiers import AUTOMATIC_IDENTIFIERS
from apps.common.serializers import TenantOwnedModelSerializer
from apps.projects.models import Project
from apps.resources.models import Supplier


pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("label", AUTOMATIC_IDENTIFIERS)
def test_identifiers_generated_and_preserved(label):
    tenant = Tenant.objects.create(name="Entreprise", slug="automatic")
    project = Project.objects.create(tenant=tenant, name="Chantier")
    supplier = Supplier.objects.create(tenant=tenant, name="Fournisseur")
    model = apps.get_model(label)
    field, prefix = AUTOMATIC_IDENTIFIERS[label]
    values = {"tenant": tenant}
    if label in {"projects.lot", "resources.purchaseorder", "qhse.ppsps", "budget.amendment"}:
        values["project"] = project
    if label == "resources.purchaseorder":
        values["supplier"] = supplier
    if label == "budget.amendment":
        values.update(amount=0, currency="BIF")
    obj = model.objects.create(**values)
    identifier = getattr(obj, field)
    assert identifier == f"{prefix}-{obj.pk.hex.upper()}"
    obj.save()
    obj.refresh_from_db()
    assert getattr(obj, field) == identifier
    if label != "qhse.ppsps":
        other = model.objects.create(**values)
        assert getattr(other, field) != identifier
    # Existing imports and seed data retain their identifiers.
    setattr(obj, field, "LEGACY-001")
    obj.save()
    obj.refresh_from_db()
    assert getattr(obj, field) == "LEGACY-001"


@pytest.mark.parametrize("label", AUTOMATIC_IDENTIFIERS)
def test_api_fields_are_automatic(label):
    app_label, _ = label.split(".")
    module = import_module(f"apps.{app_label}.serializers")
    model = apps.get_model(label)
    serializer_class = next(
        cls for cls in vars(module).values()
        if isinstance(cls, type) and issubclass(cls, TenantOwnedModelSerializer)
        and getattr(getattr(cls, "Meta", None), "model", None) is model
    )
    field_name, _ = AUTOMATIC_IDENTIFIERS[label]
    serializer = serializer_class()
    assert serializer.fields[field_name].read_only
    assert not serializer.fields[field_name].required


def test_project_api_creates_identifier_without_manual_input():
    from apps.projects.serializers import ProjectSerializer

    tenant = Tenant.objects.create(name="Entreprise", slug="api-automatic")
    serializer = ProjectSerializer(data={"name": "Chantier", "code": "MANUAL"})
    assert serializer.is_valid(), serializer.errors
    project = serializer.save(tenant=tenant)
    assert project.code.startswith("PRJ-")
    serializer = ProjectSerializer(project, data={"code": "CHANGED"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().code == project.code
