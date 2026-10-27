from datetime import date
from decimal import Decimal

import pytest

from apps.accounts.models import Membership, Tenant, User
from apps.budget.models import Budget, BudgetLine, Expense
from apps.planning.models import Task
from apps.projects.models import Lot, Project
from apps.resources.models import Material, StockLocation
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db


def test_dashboard_counts_entire_dataset_and_scopes_project(setup):
    tenant, _, project, _, client = setup
    Task.objects.bulk_create([Task(tenant=tenant, project=project, name=f"Task {index}") for index in range(65)])
    other = Project.objects.create(tenant=tenant, code="P2", name="Other")
    Task.objects.create(tenant=tenant, project=other, name="Other task")
    response = client.get("/api/v1/projects/dashboard/", {"project": str(project.pk)})
    assert response.status_code == 200
    assert response.data["planning"]["count"] == 68
    assert response.data["projects"]["count"] == 1


def test_dashboard_omits_unauthorized_modules_and_directory_is_tenant_scoped(setup):
    tenant, _, _, _, client = setup
    user, _ = member(tenant, "worker", {"planning": ["read"]})
    User.objects.create_user(username="outsider", email="outsider@test.local")
    client.force_authenticate(user)
    data = client.get("/api/v1/projects/dashboard/").data
    assert data["planning"]["count"] == 3
    assert data["budget"] is None and data["projects"] is None and data["qhse"] is None
    directory = client.get("/api/v1/auth/directory/")
    assert directory.status_code == 200
    assert {item["email"] for item in directory.data} == {"admin@test.local", "worker@test.local"}


def test_options_exposes_form_constraints_and_relations_for_nonadmin(setup):
    tenant, _, _, _, client = setup
    user, _ = member(tenant, permissions={"planning": ["create", "read", "update"]})
    client.force_authenticate(user)
    response = client.options("/api/v1/planning/tasks/")
    assert response.status_code == 200
    assert response.data["fields"]["project"]["related_model"] == "projects.project"
    assert response.data["fields"]["status"]["choices"]
    assert response.data["actions"]["POST"]["progress_percent"]["default"] == 0


def test_indirect_project_filters_and_financial_totals(setup):
    tenant, _, project, _, client = setup
    other = Project.objects.create(tenant=tenant, code="P2", name="Other")
    budgets = [Budget.objects.create(tenant=tenant, project=item) for item in [project, other]]
    lines = [BudgetLine.objects.create(tenant=tenant, budget=budget, label="Line", amount=1000) for budget in budgets]
    payload = {"budget_line": str(lines[0].pk), "date": "2026-10-26", "amount_excluding_tax": "100.00", "tax_amount": "18.00", "currency": "BIF", "amount_including_tax": "999.00", "status": "paid"}
    response = client.post("/api/v1/budget/expenses/", payload)
    assert response.status_code == 201, response.data
    assert Decimal(response.data["amount_including_tax"]) == Decimal("118.00")
    assert response.data["status"] == "draft"
    Expense.objects.create(tenant=tenant, budget_line=lines[1], date=date.today(), amount_excluding_tax=1, amount_including_tax=1, currency="BIF")
    filtered = client.get("/api/v1/budget/expenses/", {"project": str(project.pk)})
    assert len(filtered.data["results"]) == 1
    assert client.post(f"/api/v1/budget/expenses/{response.data['id']}/validate/", {}).status_code == 200
    assert client.patch(f"/api/v1/budget/expenses/{response.data['id']}/", {"amount_excluding_tax": "200.00"}).status_code == 400


def test_invoice_lifecycle_and_journal_workflow(setup):
    _, _, project, _, client = setup
    response = client.post("/api/v1/budget/invoices/", {"project": str(project.pk), "invoice_number": "INV1", "issue_date": "2026-10-26", "amount_excluding_tax": "100.00", "tax_amount": "18.00", "currency": "BIF"})
    assert response.status_code == 201, response.data
    endpoint = f"/api/v1/budget/invoices/{response.data['id']}/"
    assert client.post(endpoint + "pay/", {}).status_code == 400
    assert client.post(endpoint + "validate/", {}).status_code == 200
    assert client.post(endpoint + "pay/", {}).data["status"] == "paid"
    report = client.post("/api/v1/progress/daily-reports/", {"project": str(project.pk), "report_date": "2026-10-26", "work_done": "Fondations"})
    assert report.status_code == 201
    endpoint = f"/api/v1/progress/daily-reports/{report.data['id']}/"
    assert client.post(endpoint + "validate/", {}).status_code == 400
    assert client.post(endpoint + "submit/", {}).status_code == 200
    assert client.post(endpoint + "validate/", {}).status_code == 200
    assert client.patch(endpoint, {"work_done": "modified"}).status_code == 400


def test_stock_movements_produce_balances_and_prevent_negative_stock(setup):
    tenant, _, project, _, client = setup
    material = Material.objects.create(tenant=tenant, reference="CIM", name="Ciment", unit="sac")
    depot = StockLocation.objects.create(tenant=tenant, project=project, name="Depot", code="D1")
    incoming = {"material": str(material.pk), "target_location": str(depot.pk), "quantity": "10", "movement_type": "in", "movement_date": "2026-10-26"}
    response = client.post("/api/v1/resources/stock-movements/", incoming)
    assert response.status_code == 201, response.data
    outgoing = {**incoming, "source_location": str(depot.pk), "target_location": "", "quantity": "11", "movement_type": "out"}
    outgoing.pop("target_location")
    assert client.post("/api/v1/resources/stock-movements/", outgoing).status_code == 400
    outgoing["quantity"] = "4"
    assert client.post("/api/v1/resources/stock-movements/", outgoing).status_code == 201
    stock = client.get(f"/api/v1/resources/materials/{material.pk}/stock/")
    assert Decimal(stock.data[0]["quantity"]) == 6
    assert client.delete(f"/api/v1/resources/stock-movements/{response.data['id']}/").status_code == 405


def test_soft_deleting_lot_keeps_tasks_visible_and_unlinks_lot(setup):
    tenant, _, project, (task, _, _), client = setup
    lot = Lot.objects.create(tenant=tenant, project=project, name="Lot", code="L")
    task.lot = lot
    task.save()
    assert client.delete(f"/api/v1/projects/lots/{lot.pk}/").status_code == 204
    task.refresh_from_db()
    assert task.lot_id is None
    assert client.get(f"/api/v1/planning/tasks/{task.pk}/").status_code == 200


def test_progress_starts_task_and_completion_remains_consistent(setup):
    _, _, _, (task, _, _), client = setup
    endpoint = f"/api/v1/planning/tasks/{task.pk}/update-progress/"
    assert client.post(endpoint, {"progress_percent": 40}).data["status"] == "in_progress"
    assert client.post(endpoint, {"progress_percent": 100}).data["status"] == "done"
    assert client.post(endpoint, {"progress_percent": 0}).data["status"] == "todo"


def test_inspection_copies_template_checklist_and_calculates_score(setup):
    from apps.qhse.models import InspectionItem
    _, _, project, _, client = setup
    template = client.post("/api/v1/qhse/inspection-templates/", {
        "name": "Securite", "code": "SEC", "items": ["Casques portes", "Acces degage"],
    }, format="json")
    assert template.status_code == 201, template.data
    inspection = client.post("/api/v1/qhse/inspections/", {
        "project": str(project.pk), "template": template.data["id"], "inspection_date": "2026-10-26",
    })
    assert inspection.status_code == 201, inspection.data
    items = InspectionItem.objects.filter(inspection_id=inspection.data["id"])
    assert items.count() == 2
    item = items.first()
    item_endpoint = f"/api/v1/qhse/inspection-items/{item.pk}/"
    assert client.patch(item_endpoint, {"is_compliant": True}).status_code == 200
    response = client.post(f"/api/v1/qhse/inspections/{inspection.data['id']}/complete/", {})
    assert response.status_code == 200, response.data
    assert Decimal(response.data["score"]) == 50
    assert client.patch(item_endpoint, {"is_compliant": False}).status_code == 400
    assert client.delete(item_endpoint).status_code == 400


def test_inspection_template_rejects_invalid_checklist(setup):
    *_, client = setup
    for items in ["wrong", [12], [{"label": 1}], [""]]:
        response = client.post("/api/v1/qhse/inspection-templates/", {
            "name": "Invalid", "code": "BAD", "items": items,
        }, format="json")
        assert response.status_code == 400


def test_platform_overview_is_global_and_restricted_to_superusers(setup):
    from apps.accounts.models import AuditLog
    tenant, _, _, _, client = setup
    other = Tenant.objects.create(name="Second", slug="platform-other")
    Project.objects.create(tenant=other, name="Other", code="P2")
    AuditLog.objects.bulk_create([AuditLog(tenant=tenant, action="test") for _ in range(65)])
    response = client.get("/api/v1/auth/platform/overview/")
    assert response.status_code == 200
    assert response.data["tenants"] == 2
    assert response.data["projects"] == 2
    assert response.data["audit_events"] == 65
    assert response.data["database"] == "available"
    user, _ = member(tenant, permissions={"*": ["crud", "validate"]})
    client.force_authenticate(user)
    assert client.get("/api/v1/auth/platform/overview/").status_code == 403
