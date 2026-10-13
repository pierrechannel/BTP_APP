import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import Tenant
from apps.accounts.models import Membership, Role, User
from apps.budget.models import Budget
from apps.documents.models import DocumentVersion
from apps.equipment.models import Equipment
from apps.notifications.models import Notification
from apps.planning.models import Task
from apps.progress.models import DailyReport
from apps.qhse.models import CorrectiveAction, Incident
from apps.reports.models import ReportTemplate
from apps.sync.models import SyncMutation
from apps.workforce.models import TimeEntry
from apps.projects.models import Project


@pytest.fixture
def seeded_demo(db):
    call_command("seed_demo", verbosity=0)
    return Tenant.objects.get(slug="demo-burundi-btp")


@pytest.fixture
def api_client(seeded_demo):
    client = APIClient()
    response = client.post(
        "/api/v1/auth/token/",
        {"email": "admin@chantier.local", "password": "ChangeMe123!"},
        format="json",
    )
    assert response.status_code == 200
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {response.data['access']}",
        HTTP_X_TENANT_ID=str(seeded_demo.id),
    )
    return client


@pytest.mark.django_db
def test_all_list_endpoints_are_accessible(api_client):
    paths = [
        "/api/v1/auth/me/",
        "/api/v1/auth/tenants/",
        "/api/v1/auth/users/",
        "/api/v1/auth/roles/",
        "/api/v1/auth/memberships/",
        "/api/v1/auth/devices/",
        "/api/v1/auth/audit-logs/",
        "/api/v1/projects/",
        "/api/v1/projects/lots/",
        "/api/v1/projects/stakeholders/",
        "/api/v1/planning/tasks/",
        "/api/v1/planning/dependencies/",
        "/api/v1/budget/budgets/",
        "/api/v1/budget/budget-lines/",
        "/api/v1/budget/expenses/",
        "/api/v1/budget/invoices/",
        "/api/v1/budget/amendments/",
        "/api/v1/budget/exchange-rates/",
        "/api/v1/resources/materials/",
        "/api/v1/resources/suppliers/",
        "/api/v1/resources/purchase-orders/",
        "/api/v1/resources/purchase-order-lines/",
        "/api/v1/resources/stock-locations/",
        "/api/v1/resources/stock-movements/",
        "/api/v1/workforce/workers/",
        "/api/v1/workforce/time-entries/",
        "/api/v1/workforce/certifications/",
        "/api/v1/workforce/worker-certifications/",
        "/api/v1/workforce/assignments/",
        "/api/v1/equipment/equipment/",
        "/api/v1/equipment/assignments/",
        "/api/v1/equipment/maintenance-plans/",
        "/api/v1/equipment/maintenance-records/",
        "/api/v1/equipment/usage-logs/",
        "/api/v1/progress/daily-reports/",
        "/api/v1/progress/photos/",
        "/api/v1/progress/progress-updates/",
        "/api/v1/progress/snags/",
        "/api/v1/qhse/incidents/",
        "/api/v1/qhse/corrective-actions/",
        "/api/v1/qhse/inspection-templates/",
        "/api/v1/qhse/inspections/",
        "/api/v1/qhse/inspection-items/",
        "/api/v1/qhse/ppsps/",
        "/api/v1/documents/folders/",
        "/api/v1/documents/documents/",
        "/api/v1/documents/versions/",
        "/api/v1/documents/acls/",
        "/api/v1/documents/approval-workflows/",
        "/api/v1/notifications/notifications/",
        "/api/v1/notifications/messages/",
        "/api/v1/notifications/preferences/",
        "/api/v1/notifications/channels/",
        "/api/v1/reports/templates/",
        "/api/v1/reports/runs/",
        "/api/v1/reports/kpi-snapshots/",
        "/api/v1/sync/mutations/",
    ]

    failures = []
    for path in paths:
        response = api_client.get(path)
        if response.status_code >= 400:
            failures.append((path, response.status_code, response.content[:300]))

    assert failures == []


@pytest.mark.django_db
def test_role_permissions_block_forbidden_actions(seeded_demo):
    client_role = Role.objects.get(tenant=seeded_demo, code=Role.CLIENT)
    user = User.objects.create_user(
        email="client.only@chantier.local",
        username="client_only",
        password="ChangeMe123!",
    )
    Membership.objects.create(user=user, tenant=seeded_demo, role=client_role)

    client = APIClient()
    response = client.post(
        "/api/v1/auth/token/",
        {"email": "client.only@chantier.local", "password": "ChangeMe123!"},
        format="json",
    )
    assert response.status_code == 200
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {response.data['access']}",
        HTTP_X_TENANT_ID=str(seeded_demo.id),
    )

    response = client.post("/api/v1/budget/expenses/", {}, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_cross_tenant_references_are_rejected(api_client):
    other_tenant = Tenant.objects.create(name="Other Tenant", slug="other-tenant")
    other_project = Project.objects.create(
        tenant=other_tenant,
        name="Other Project",
        code="OTHER-001",
        currency="BIF",
    )

    response = api_client.post(
        "/api/v1/projects/lots/",
        {"project": str(other_project.id), "name": "Bad Lot", "code": "BAD"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_seeded_project_is_returned(api_client):
    response = api_client.get("/api/v1/projects/")

    assert response.status_code == 200
    assert response.data["results"][0]["code"] == "CHANT-001"


@pytest.mark.django_db
def test_business_actions_are_accessible(api_client):
    actions = [
        ("get", f"/api/v1/budget/budgets/{Budget.objects.first().id}/summary/", None),
        (
            "post",
            f"/api/v1/planning/tasks/{Task.objects.first().id}/update-progress/",
            {"progress_percent": 40},
        ),
        ("post", f"/api/v1/workforce/time-entries/{TimeEntry.objects.first().id}/validate/", {}),
        (
            "post",
            f"/api/v1/equipment/equipment/{Equipment.objects.first().id}/update-state/",
            {"state": "operationnel"},
        ),
        ("post", f"/api/v1/progress/daily-reports/{DailyReport.objects.first().id}/submit/", {}),
        ("post", f"/api/v1/progress/daily-reports/{DailyReport.objects.first().id}/validate/", {}),
        ("post", f"/api/v1/qhse/incidents/{Incident.objects.first().id}/close/", {}),
        (
            "post",
            f"/api/v1/qhse/corrective-actions/{CorrectiveAction.objects.first().id}/complete/",
            {},
        ),
        (
            "post",
            f"/api/v1/documents/versions/{DocumentVersion.objects.first().id}/mark-current/",
            {},
        ),
        (
            "post",
            f"/api/v1/notifications/notifications/{Notification.objects.first().id}/mark-read/",
            {},
        ),
        (
            "post",
            f"/api/v1/reports/templates/{ReportTemplate.objects.first().id}/run/",
            {"parameters": {"project": "CHANT-001"}},
        ),
        ("post", f"/api/v1/sync/mutations/{SyncMutation.objects.first().id}/mark-applied/", {}),
    ]

    failures = []
    for method, path, payload in actions:
        response = getattr(api_client, method)(path, payload or {}, format="json")
        if response.status_code >= 400:
            failures.append((path, response.status_code, response.content[:300]))

    assert failures == []
