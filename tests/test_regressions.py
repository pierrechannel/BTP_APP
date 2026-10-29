from datetime import date
from uuid import uuid4
from unittest.mock import patch
from pypdf import PdfReader

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, Membership, Role, Tenant, User
from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder
from apps.planning.models import Task, TaskDependency
from apps.projects.models import Lot, Project
from apps.sync.models import SyncMutation
from apps.reports.models import ReportRun, ReportTemplate
from apps.budget.models import Budget, BudgetLine, Expense, Invoice
from apps.workforce.models import Certification, TimeEntry, Worker, WorkerCertification
from apps.workforce.services import has_valid_certification

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup():
    tenant = Tenant.objects.create(name="Entreprise", slug="regressions")
    admin = User.objects.create_user(username="admin", email="admin@test.local", is_superuser=True)
    role = Role.objects.create(tenant=tenant, code="admin", name="Admin", permissions={"*": ["crud", "validate"]})
    Membership.objects.create(tenant=tenant, user=admin, role=role)
    project = Project.objects.create(tenant=tenant, name="Projet", code="P1")
    tasks = [Task.objects.create(tenant=tenant, project=project, name=name) for name in "ABC"]
    client = APIClient()
    client.force_authenticate(admin)
    client.credentials(HTTP_X_TENANT_ID=str(tenant.pk))
    return tenant, admin, project, tasks, client


def member(tenant, code="site_manager", permissions=None):
    user = User.objects.create_user(username=code, email=f"{code}@test.local")
    role = Role.objects.create(tenant=tenant, code=code, name=code, permissions=permissions or {})
    Membership.objects.create(tenant=tenant, user=user, role=role)
    return user, role


def documents(setup):
    tenant, admin, project, _, _ = setup
    folder = Folder.objects.create(tenant=tenant, project=project, name="Plans")
    document = Document.objects.create(tenant=tenant, folder=folder, title="Plan", created_by=admin)
    return document


def test_dependency_cycles_and_self_reference_rejected_on_create_and_patch(setup):
    tenant, _, _, (a, b, c), client = setup
    first = TaskDependency.objects.create(tenant=tenant, predecessor=a, successor=b)
    TaskDependency.objects.create(tenant=tenant, predecessor=b, successor=c)
    endpoint = "/api/v1/planning/dependencies/"
    for predecessor, successor in [(c, a), (a, a)]:
        assert client.post(endpoint, {"predecessor": str(predecessor.pk), "successor": str(successor.pk)}).status_code == 400
    assert client.patch(f"{endpoint}{first.pk}/", {"predecessor": str(c.pk)}).status_code == 400
    assert TaskDependency.objects.count() == 2


def test_dependency_cross_project_and_cross_tenant_rejected(setup):
    tenant, _, _, (a, _, _), client = setup
    other_project = Project.objects.create(tenant=tenant, name="Autre", code="P2")
    other = Task.objects.create(tenant=tenant, project=other_project, name="Autre")
    endpoint = "/api/v1/planning/dependencies/"
    assert client.post(endpoint, {"predecessor": str(a.pk), "successor": str(other.pk)}).status_code == 400
    foreign = Tenant.objects.create(name="Autre", slug="other")
    foreign_project = Project.objects.create(tenant=foreign, name="Secret", code="S")
    other = Task.objects.create(tenant=foreign, project=foreign_project, name="Secret")
    assert client.post(endpoint, {"predecessor": str(a.pk), "successor": str(other.pk)}).status_code == 400
    assert client.get(f"/api/v1/planning/tasks/{other.pk}/").status_code == 404


def test_task_hierarchy_and_partial_dates_validation(setup):
    tenant, _, project, (a, b, _), client = setup
    endpoint = "/api/v1/planning/tasks/"
    a.parent = b
    a.planned_start_date = date(2026, 10, 20)
    a.save()
    assert client.patch(f"{endpoint}{b.pk}/", {"parent": str(a.pk)}).status_code == 400
    assert client.patch(f"{endpoint}{a.pk}/", {"planned_end_date": "2026-10-19"}).status_code == 400
    assert client.patch(f"{endpoint}{a.pk}/", {"status": "invented"}).status_code == 400
    other_project = Project.objects.create(tenant=tenant, name="Autre", code="P2")
    lot = Lot.objects.create(tenant=tenant, project=other_project, name="Lot", code="L")
    assert client.patch(f"{endpoint}{a.pk}/", {"lot": str(lot.pk)}).status_code == 400


@pytest.mark.parametrize("progress", [-1, 101, 4.5, "invalid", None])
def test_invalid_progress_rejected(setup, progress):
    *_, (a, _, _), client = setup
    response = client.post(f"/api/v1/planning/tasks/{a.pk}/update-progress/", {"progress_percent": progress}, format="json")
    assert response.status_code == 400


def test_progress_status_and_optimistic_version(setup):
    tenant, _, _, (a, _, _), client = setup
    endpoint = f"/api/v1/planning/tasks/{a.pk}/"
    response = client.patch(endpoint, {"progress_percent": 100}, HTTP_IF_MATCH='"1"')
    assert response.status_code == 200
    assert response.data["status"] == "done"
    assert response["ETag"] == '"2"'
    assert client.patch(endpoint, {"progress_percent": 40}, HTTP_IF_MATCH='"1"').status_code == 409
    response = client.post(endpoint + "update-progress/", {"progress_percent": 40}, HTTP_IF_MATCH='"2"')
    assert response.status_code == 200 and response.data["status"] == "in_progress"
    assert AuditLog.objects.filter(tenant=tenant, action="update_progress").exists()


def test_soft_delete_hides_object_and_rejects_reference(setup):
    _, _, _, (a, b, _), client = setup
    endpoint = f"/api/v1/planning/tasks/{a.pk}/"
    assert client.delete(endpoint).status_code == 204
    a.refresh_from_db()
    assert a.deleted_at is not None
    assert client.get(endpoint).status_code == 404
    assert client.patch(f"/api/v1/planning/tasks/{b.pk}/", {"parent": str(a.pk)}).status_code == 400


def test_project_soft_delete_preserves_and_hides_cascade_tree(setup):
    tenant, _, project, (a, b, _), client = setup
    dependency = TaskDependency.objects.create(tenant=tenant, predecessor=a, successor=b)
    document = documents(setup)
    assert client.delete(f"/api/v1/projects/{project.pk}/").status_code == 204
    for obj in [project, a, b, dependency, document]:
        obj.refresh_from_db()
        assert obj.deleted_at is not None
    assert client.get("/api/v1/planning/dependencies/").data["results"] == []
    assert client.get("/api/v1/documents/documents/").data["results"] == []


def test_simple_member_cannot_manage_users_roles_memberships_or_audit(setup):
    tenant, admin, _, _, client = setup
    user, _ = member(tenant, permissions={"projects": ["read"]})
    client.force_authenticate(user)
    for endpoint in ["users", "roles", "memberships", "audit-logs"]:
        assert client.get(f"/api/v1/auth/{endpoint}/").status_code == 403
    assert client.patch(f"/api/v1/auth/users/{admin.pk}/", {"is_active": False}).status_code == 403
    client.force_authenticate(admin)
    admin.is_superuser = False
    admin.save()
    assert client.get("/api/v1/auth/users/").status_code == 200
    assert client.delete(f"/api/v1/auth/users/{user.pk}/").status_code == 403


def test_superuser_can_manage_global_users_and_changes_are_audited(setup):
    tenant, admin, _, _, client = setup
    response = client.post("/api/v1/auth/users/", {"username": "new_user", "email": "new@test.local"})
    assert response.status_code == 201
    user = User.objects.get(pk=response.data["id"])
    assert not user.has_usable_password()
    Membership.objects.create(tenant=tenant, user=user, role=Membership.objects.get(user=admin).role)
    assert client.patch(f"/api/v1/auth/users/{user.pk}/", {"first_name": "Nouveau"}).status_code == 200
    assert AuditLog.objects.filter(tenant=tenant, resource_type="accounts.User", action="partial_update").exists()


def test_custom_action_uses_role_update_permission(setup):
    tenant, _, _, (a, _, _), client = setup
    user, _ = member(tenant, permissions={"planning": ["read", "update"]})
    client.force_authenticate(user)
    assert client.post(f"/api/v1/planning/tasks/{a.pk}/update-progress/", {"progress_percent": 30}).status_code == 200


def test_invalid_and_disabled_tenant_denied(setup):
    tenant, _, _, _, client = setup
    client.credentials(HTTP_X_TENANT_ID="invalid")
    assert client.get("/api/v1/planning/tasks/").status_code == 403
    tenant.is_active = False
    tenant.save()
    client.credentials(HTTP_X_TENANT_ID=str(tenant.pk))
    assert client.get("/api/v1/planning/tasks/").status_code == 403


def test_document_acl_protects_document_and_versions(setup):
    tenant, _, _, _, client = setup
    document = documents(setup)
    user, role = member(tenant, permissions={"documents": ["read", "update", "create"]})
    outsider, _ = member(tenant, "other")
    DocumentAcl.objects.create(tenant=tenant, document=document, user=outsider, permission="read")
    version = DocumentVersion.objects.create(tenant=tenant, document=document, version_label="A")
    client.force_authenticate(user)
    endpoint = f"/api/v1/documents/documents/{document.pk}/"
    assert client.get(endpoint).status_code == 404
    assert client.get(f"/api/v1/documents/versions/{version.pk}/").status_code == 404
    assert client.get("/api/v1/documents/documents/").data["results"] == []
    assert client.post("/api/v1/documents/approval-workflows/", {"document": str(document.pk), "reviewer": outsider.pk}).status_code == 403
    DocumentAcl.objects.create(tenant=tenant, document=document, role=role, permission="read")
    assert client.get(endpoint).status_code == 200
    assert client.patch(endpoint, {"title": "changed"}).status_code == 404
    assert client.post("/api/v1/documents/acls/", {"document": str(document.pk), "user": user.pk, "permission": "write"}).status_code == 403


def test_read_shared_requires_explicit_grant(setup):
    tenant, _, _, _, client = setup
    document = documents(setup)
    user, role = member(tenant, "client", {"documents": ["read_shared"]})
    client.force_authenticate(user)
    assert client.get("/api/v1/documents/documents/").data["results"] == []
    DocumentAcl.objects.create(tenant=tenant, document=document, role=role, permission="read")
    assert len(client.get("/api/v1/documents/documents/").data["results"]) == 1


def test_workflow_only_assigned_reviewer_can_decide_once(setup):
    tenant, admin, _, _, client = setup
    document = documents(setup)
    reviewer, _ = member(tenant, permissions={"documents": ["read", "validate"]})
    workflow = ApprovalWorkflow.objects.create(tenant=tenant, document=document, requested_by=admin, reviewer=reviewer)
    endpoint = f"/api/v1/documents/approval-workflows/{workflow.pk}/"
    assert client.post(endpoint + "approve/", {}).status_code == 403
    client.force_authenticate(reviewer)
    assert client.post(endpoint + "approve/", {}).status_code == 200
    document.refresh_from_db()
    assert document.status == Document.APPROVED
    assert client.post(endpoint + "reject/", {}).status_code == 400
    assert client.patch(endpoint, {"status": "pending"}).status_code == 403


def test_upload_new_version_makes_previous_noncurrent(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    tenant, _, _, _, client = setup
    document = documents(setup)
    previous = DocumentVersion.objects.create(tenant=tenant, document=document, version_label="A")
    response = client.post("/api/v1/documents/versions/", {
        "document": str(document.pk), "version_label": "B", "original_name": "plan.txt",
        "file": SimpleUploadedFile("plan.txt", b"plan"),
    }, format="multipart")
    assert response.status_code == 201, response.data
    previous.refresh_from_db()
    assert not previous.is_current
    assert DocumentVersion.objects.filter(document=document, is_current=True, deleted_at__isnull=True).count() == 1


def test_sync_apply_is_real_and_idempotent_and_detects_conflicts(setup):
    tenant, admin, project, (task, _, _), client = setup
    endpoint = "/api/v1/sync/mutations/"
    payload = {"client_mutation_id": str(uuid4()), "resource_type": "planning.task",
               "resource_id": str(task.pk), "operation": "update",
               "payload": {"name": "Modifie hors ligne", "expected_version": 1}}
    response = client.post(endpoint, payload, format="json")
    assert response.status_code == 201, response.data
    mutation_id = response.data["id"]
    assert client.post(endpoint, payload, format="json").status_code == 200
    apply_url = f"{endpoint}{mutation_id}/mark-applied/"
    assert client.post(apply_url, {}, format="json").status_code == 200
    task.refresh_from_db()
    assert task.name == "Modifie hors ligne" and task.version == 2
    assert client.post(apply_url, {}, format="json").status_code == 200
    task.refresh_from_db()
    assert task.version == 2
    payload["client_mutation_id"] = str(uuid4())
    response = client.post(endpoint, payload, format="json")
    assert response.status_code == 201
    assert client.post(f"{endpoint}{response.data['id']}/mark-applied/", {}).status_code == 409
    payload["payload"] = {"name": "collision"}
    assert client.post(endpoint, payload, format="json").status_code == 409


def test_sync_enforces_domain_permissions_and_rejects_unknown_resource(setup):
    tenant, admin, _, (task, _, _), client = setup
    user, _ = member(tenant, permissions={"sync": ["create", "update"], "planning": ["read"]})
    mutation = SyncMutation.objects.create(tenant=tenant, client_mutation_id=uuid4(),
        resource_type="planning.task", resource_id=task.pk, operation="update",
        payload={"name": "Forbidden", "expected_version": 1})
    client.force_authenticate(user)
    assert client.post(f"/api/v1/sync/mutations/{mutation.pk}/mark-applied/", {}).status_code == 403
    client.force_authenticate(admin)
    mutation.resource_type = "accounts.user"
    mutation.save()
    assert client.post(f"/api/v1/sync/mutations/{mutation.pk}/mark-applied/", {}).status_code == 400
    task.refresh_from_db()
    assert task.name != "Forbidden"


def test_report_analytics_scope_and_permissions(setup):
    from django.utils import timezone

    tenant, _, project, tasks, client = setup
    tasks[0].status = Task.DONE
    tasks[0].progress_percent = 100
    tasks[0].save()
    tasks[1].planned_end_date = date(2000, 1, 1)
    tasks[1].save()
    tasks[2].deleted_at = timezone.now()
    tasks[2].save()
    other = Tenant.objects.create(name="Secret", slug="analytics-other")
    secret = Project.objects.create(tenant=other, name="Confidentiel")
    Task.objects.create(tenant=other, project=secret, name="Secret")
    endpoint = "/api/v1/reports/templates/summary/"
    response = client.get(endpoint)
    assert response.status_code == 200
    assert response.data["kpis"] == {"projects": 1, "tasks": 2, "completed": 1, "progress": 50, "overdue": 1, "open_incidents": 0}
    assert len(response.data["projects"]) == 1
    assert str(response.data["projects"][0]["id"]) == str(project.pk)
    assert client.get(endpoint, {"project": str(secret.pk)}).data["kpis"]["projects"] == 0
    assert client.get(endpoint, {"project": "invalid"}).status_code == 400
    assert client.get(endpoint, {"start_date": "2026-10-31", "end_date": "2026-10-01"}).status_code == 400
    user, _ = member(tenant, "analytics-reader", {"planning": ["read"]})
    client.force_authenticate(user)
    assert client.get(endpoint).status_code == 403
    client.force_authenticate(None)
    assert client.get(endpoint).status_code == 401


def test_report_generation_and_authenticated_download(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.REPORTS_ASYNC = False
    tenant, _, project, _, client = setup
    template = ReportTemplate.objects.create(tenant=tenant, name="Synthese", code="PROJECT_DASHBOARD")
    response = client.post(f"/api/v1/reports/templates/{template.pk}/run/", {"parameters": {"project": project.code}}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["status"] == "completed"
    run = ReportRun.objects.get(pk=response.data["id"])
    with run.result_file.open("rb") as report:
        assert report.read(5) == b"%PDF-"
        report.seek(0)
        reader = PdfReader(report)
        content = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) >= 1
    assert project.code in content
    assert "3 tâches" in content
    assert "Situation financière" in content
    assert "Qualité et sécurité" in content
    download = client.get(f"/api/v1/reports/runs/{run.pk}/download/")
    assert download.status_code == 200
    assert download["Content-Type"] == "application/pdf"
    assert ".pdf" in download["Content-Disposition"]
    download.close()
    client.force_authenticate(None)
    assert client.get(f"/api/v1/reports/runs/{run.pk}/download/").status_code == 401


def test_pdf_report_paginates_without_losing_table_rows(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.REPORTS_ASYNC = False
    tenant, _, project, _, client = setup
    Task.objects.bulk_create([Task(tenant=tenant, project=project, name=f"Travaux de contrôle {index:03d}") for index in range(90)])
    template = ReportTemplate.objects.create(tenant=tenant, name="Rapport détaillé")
    response = client.post(f"/api/v1/reports/templates/{template.pk}/run/", {"parameters": {"project": project.code, "observations": "Fin des observations."}}, format="json")
    assert response.status_code == 200
    run = ReportRun.objects.get(pk=response.data["id"])
    with run.result_file.open("rb") as file:
        reader = PdfReader(file)
        assert len(reader.pages) > 1
        text = "\n".join(page.extract_text() for page in reader.pages)
        assert "Travaux de contrôle 000" in text
        assert "Travaux de contrôle 089" in text
        assert "Fin des observations." in text
        assert all(f"Page {index}" in page.extract_text() for index, page in enumerate(reader.pages, 1))


def test_formatted_report_escapes_content_and_respects_scope(setup, settings, tmp_path):
    from django.utils import timezone

    settings.MEDIA_ROOT = tmp_path
    settings.REPORTS_ASYNC = False
    tenant, _, project, tasks, client = setup
    project.name = '<script>alert("test")</script>'
    project.save()
    tasks[0].name = "Tâche supprimée"
    tasks[0].deleted_at = timezone.now()
    tasks[0].save()
    Project.objects.create(tenant=tenant, name="Chantier hors périmètre", code="OUT")
    foreign = Tenant.objects.create(name="Autre entreprise", slug="report-other")
    Project.objects.create(tenant=foreign, name="Chantier confidentiel", code=project.code)
    template = ReportTemplate.objects.create(tenant=tenant, name="Rapport de suivi")
    response = client.post(f"/api/v1/reports/templates/{template.pk}/run/", {"parameters": {"project": project.code}}, format="json")
    assert response.status_code == 200
    run = ReportRun.objects.get(pk=response.data["id"])
    with run.result_file.open("rb") as report:
        content = "\n".join(page.extract_text() for page in PdfReader(report).pages)
    assert '<script>alert("test")</script>' in content
    assert "Chantier hors périmètre" not in content
    assert "Chantier confidentiel" not in content
    assert "Tâche supprimée" not in content
    assert "2 tâches" in content


@pytest.mark.parametrize("parameters", [
    {"start_date": "2026-15-01"}, {"start_date": 123},
    {"start_date": "2026-10-20", "end_date": "2026-10-01"},
    {"observations": []}, {"project": "UNKNOWN"},
])
def test_report_invalid_filters_rejected(setup, parameters):
    tenant, _, _, _, client = setup
    template = ReportTemplate.objects.create(tenant=tenant, name="Synthèse")
    response = client.post(f"/api/v1/reports/templates/{template.pk}/run/", {"parameters": parameters}, format="json")
    assert response.status_code == 400
    assert not ReportRun.objects.exists()


def test_report_period_finances_and_observations(setup, settings, tmp_path):
    from datetime import datetime
    from decimal import Decimal
    from zoneinfo import ZoneInfo
    from apps.reports.pdf import build_report_pdf
    from apps.qhse.models import Incident

    settings.MEDIA_ROOT = tmp_path
    settings.REPORTS_ASYNC = False
    tenant, _, project, tasks, client = setup
    tasks[0].planned_start_date = date(2026, 9, 1)
    tasks[0].planned_end_date = date(2026, 9, 30)
    tasks[0].name = "Tâche hors période"
    tasks[0].save()
    budget = Budget.objects.create(tenant=tenant, project=project)
    bif = BudgetLine.objects.create(tenant=tenant, budget=budget, amount=1000, currency="BIF", label="Travaux")
    BudgetLine.objects.create(tenant=tenant, budget=budget, amount=10, currency="USD", label="Import")
    for day, amount, status in [(date(2026, 10, 1), 200, Expense.VALIDATED), (date(2026, 9, 30), 700, Expense.PAID), (date(2026, 10, 2), 500, Expense.DRAFT)]:
        Expense.objects.create(tenant=tenant, budget_line=bif, date=day, amount_excluding_tax=amount, amount_including_tax=amount, currency="BIF", status=status)
    Incident.objects.create(tenant=tenant, project=project, title="Incident dans la période", occurred_at=datetime(2026, 10, 1, 0, 30, tzinfo=ZoneInfo("Africa/Bujumbura")))
    template = ReportTemplate.objects.create(tenant=tenant, name="Synthèse")
    with patch("apps.reports.tasks.build_report_pdf", wraps=build_report_pdf) as render:
        response = client.post(f"/api/v1/reports/templates/{template.pk}/run/", {"parameters": {"project": project.code, "start_date": "2026-10-01", "end_date": "2026-10-31", "observations": "Décision : renforcer l’équipe."}}, format="json")
    assert response.status_code == 200
    context = render.call_args.args[0]
    row = context["rows"][0]
    assert row["tasks"]["count"] == 2
    assert row["incidents"] == 1
    assert row["finances"] == [
        {"currency": "BIF", "planned": Decimal("1000"), "spent": Decimal("200"), "remaining": Decimal("800")},
        {"currency": "USD", "planned": Decimal("10"), "spent": 0, "remaining": Decimal("10")},
    ]
    run = ReportRun.objects.get(pk=response.data["id"])
    with run.result_file.open("rb") as report:
        content = "\n".join(page.extract_text() for page in PdfReader(report).pages)
    assert "Décision : renforcer l’équipe." in content
    assert "Tâche hors période" not in content
    assert "Situation financière" in content
    response = client.get("/api/v1/reports/templates/summary/", {"project": str(project.pk), "start_date": "2026-10-01", "end_date": "2026-10-31"})
    assert response.status_code == 200
    assert response.data["finances"] == row["finances"]
    assert response.data["kpis"]["tasks"] == 2
    assert response.data["kpis"]["open_incidents"] == 1
    assert len(response.data["monthly_expenses"]) == 1
    assert response.data["monthly_expenses"][0]["amount"] == Decimal("200")


def test_document_download_enforces_acl(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    tenant, _, _, _, client = setup
    document = documents(setup)
    version = DocumentVersion.objects.create(tenant=tenant, document=document, version_label="A",
        file=SimpleUploadedFile("plan.txt", b"plan"), original_name="plan.txt")
    user, _ = member(tenant, permissions={"documents": ["read"]})
    owner, _ = member(tenant, "owner")
    DocumentAcl.objects.create(tenant=tenant, document=document, user=owner, permission="read")
    endpoint = f"/api/v1/documents/versions/{version.pk}/download/"
    client.force_authenticate(user)
    assert client.get(endpoint).status_code == 404


def test_report_async_dispatch_happens_after_commit_and_failure_is_visible(setup, settings, django_capture_on_commit_callbacks):
    settings.REPORTS_ASYNC = True
    tenant, admin, _, _, _ = setup
    template = ReportTemplate.objects.create(tenant=tenant, name="Synthese", code="ASYNC")
    from apps.reports.services import enqueue_report_run
    with patch("apps.reports.tasks.generate_report.delay", side_effect=RuntimeError("broker unavailable")) as dispatch:
        with django_capture_on_commit_callbacks(execute=True):
            run = enqueue_report_run(template, {}, admin)
            dispatch.assert_not_called()
        dispatch.assert_called_once_with(str(run.pk))
    run.refresh_from_db()
    assert run.status == "failed"


def test_budget_currency_changes_require_no_lines_even_deleted_ones(setup):
    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project)
    url = f"/api/v1/budget/budgets/{budget.pk}/"
    assert client.patch(url, {"currency": "USD"}).status_code == 200
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, category="Labor", label="Work", amount=10, currency="USD")
    assert client.patch(url, {"currency": "BIF"}).status_code == 400
    assert client.patch(url, {"currency": "USD"}).status_code == 200
    assert client.delete(f"/api/v1/budget/budget-lines/{line.pk}/").status_code == 204
    assert client.patch(url, {"currency": "BIF"}).status_code == 400
    budget.refresh_from_db()
    assert budget.currency == "USD"


@pytest.mark.parametrize("kind,status", [("expense", "validated"), ("expense", "paid"), ("invoice", "validated"), ("invoice", "paid"), ("time_entry", True)])
def test_approved_records_and_parents_cannot_be_deleted(setup, kind, status):
    tenant, _, project, _, client = setup
    if kind == "time_entry":
        parent = Worker.objects.create(tenant=tenant, first_name="A", last_name="B")
        record = TimeEntry.objects.create(tenant=tenant, worker=parent, project=project, work_date=date(2026, 10, 29), normal_hours=8, is_validated=status)
        record_url = f"/api/v1/workforce/time-entries/{record.pk}/"
        parent_url = f"/api/v1/workforce/workers/{parent.pk}/"
    else:
        values = dict(tenant=tenant, amount_excluding_tax=10, amount_including_tax=10, currency="BIF", status=status)
        if kind == "expense":
            budget = Budget.objects.create(tenant=tenant, project=project)
            parent = BudgetLine.objects.create(tenant=tenant, budget=budget, category="Labor", label="Work", amount=10)
            record = Expense.objects.create(**values, budget_line=parent, date=date(2026, 10, 29))
            record_url = f"/api/v1/budget/expenses/{record.pk}/"
            parent_url = f"/api/v1/budget/budget-lines/{parent.pk}/"
            assert client.delete(f"/api/v1/budget/budgets/{budget.pk}/").status_code == 400
        else:
            parent = project
            record = Invoice.objects.create(**values, project=project, invoice_number="INV1", issue_date=date(2026, 10, 29))
            record_url = f"/api/v1/budget/invoices/{record.pk}/"
            parent_url = f"/api/v1/projects/{project.pk}/"
    for url in [record_url, parent_url, f"/api/v1/projects/{project.pk}/"]:
        assert client.delete(url).status_code == 400
    for obj in [record, parent, project]:
        obj.refresh_from_db()
        assert obj.deleted_at is None
    assert not AuditLog.objects.filter(tenant=tenant, action="destroy").exists()


def test_draft_financial_and_time_records_can_be_deleted(setup):
    tenant, _, project, _, client = setup
    worker = Worker.objects.create(tenant=tenant, first_name="A", last_name="B")
    entry = TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 29))
    invoice = Invoice.objects.create(tenant=tenant, project=project, invoice_number="DRAFT", issue_date=date(2026, 10, 29), amount_excluding_tax=10, amount_including_tax=10, currency="BIF")
    assert client.delete(f"/api/v1/workforce/time-entries/{entry.pk}/").status_code == 204
    assert client.delete(f"/api/v1/budget/invoices/{invoice.pk}/").status_code == 204


def test_time_entries_limit_daily_total_across_projects_and_partial_updates(setup):
    tenant, _, project, _, client = setup
    worker = Worker.objects.create(tenant=tenant, first_name="A", last_name="B")
    other = Project.objects.create(tenant=tenant, name="Other", code="P2")
    existing = TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 29), normal_hours=16, is_validated=True)
    endpoint = "/api/v1/workforce/time-entries/"
    payload = {"worker": str(worker.pk), "project": str(other.pk), "work_date": "2026-10-29", "normal_hours": "7", "overtime_hours": "2"}
    assert client.post(endpoint, payload).status_code == 400
    payload["overtime_hours"] = "1"
    response = client.post(endpoint, payload)
    assert response.status_code == 201, response.data
    url = f"{endpoint}{response.data['id']}/"
    assert client.patch(url, {"normal_hours": "7"}).status_code == 200
    assert client.patch(url, {"overtime_hours": "2"}).status_code == 400
    assert client.patch(url, {"work_date": "2026-10-30", "normal_hours": "20"}).status_code == 200
    assert client.patch(url, {"work_date": "2026-10-29"}).status_code == 400
    assert client.delete(url).status_code == 204
    payload["normal_hours"] = "8"
    payload["overtime_hours"] = "0"
    assert client.post(endpoint, payload).status_code == 201
    existing.refresh_from_db()
    assert existing.normal_hours == 16


def test_time_entry_worker_change_checks_destination_daily_total(setup):
    tenant, _, project, _, client = setup
    workers = [Worker.objects.create(tenant=tenant, first_name=name, last_name="B") for name in "AB"]
    entries = [TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 29), normal_hours=16) for worker in workers]
    assert client.patch(f"/api/v1/workforce/time-entries/{entries[0].pk}/", {"worker": str(workers[1].pk)}).status_code == 400


def test_worker_rate_validation_on_create_and_patch(setup):
    _, _, _, _, client = setup
    endpoint = "/api/v1/workforce/workers/"
    payload = {"first_name": "A", "last_name": "B", "hourly_rate": "-1"}
    assert client.post(endpoint, payload).status_code == 400
    payload["hourly_rate"] = "0"
    response = client.post(endpoint, payload)
    assert response.status_code == 201
    url = f"{endpoint}{response.data['id']}/"
    assert client.patch(url, {"hourly_rate": "-0.01"}).status_code == 400
    assert client.patch(url, {"hourly_rate": None}, format="json").status_code == 200


def test_certification_date_validation_and_validity_boundaries(setup):
    tenant, _, _, _, client = setup
    worker = Worker.objects.create(tenant=tenant, first_name="A", last_name="B")
    certification = Certification.objects.create(tenant=tenant, code="C", name="Certification")
    endpoint = "/api/v1/workforce/worker-certifications/"
    payload = {"worker": str(worker.pk), "certification": str(certification.pk), "issued_at": "2026-10-29", "expires_at": "2026-10-28"}
    assert client.post(endpoint, payload).status_code == 400
    payload["expires_at"] = "2026-10-30"
    response = client.post(endpoint, payload)
    assert response.status_code == 201, response.data
    url = f"{endpoint}{response.data['id']}/"
    assert client.patch(url, {"issued_at": "2026-10-31"}).status_code == 400
    assert client.patch(url, {"expires_at": "2026-10-28"}).status_code == 400
    record = WorkerCertification.objects.get(pk=response.data["id"])
    assert not has_valid_certification(record, date(2026, 10, 28))
    assert has_valid_certification(record, date(2026, 10, 29))
    assert has_valid_certification(record, date(2026, 10, 30))
    assert not has_valid_certification(record, date(2026, 10, 31))
    record.expires_at = None
    assert not has_valid_certification(record, date(2026, 10, 28))
    assert has_valid_certification(record, date(2030, 1, 1))
    record.issued_at = None
    assert has_valid_certification(record, date(2020, 1, 1))


def test_denied_writes_never_acquire_tenant_write_lock(setup):
    tenant, admin, _, (task, _, _), client = setup
    user, _ = member(tenant, permissions={"planning": ["read"]})
    endpoint = f"/api/v1/planning/tasks/{task.pk}/"
    with patch("apps.common.concurrency.Tenant.objects.select_for_update") as lock:
        client.force_authenticate(None)
        client.credentials(HTTP_X_TENANT_ID=str(tenant.pk))
        assert client.patch(endpoint, {"name": "Denied"}).status_code == 401
        client.force_authenticate(user)
        assert client.patch(endpoint, {"name": "Denied"}).status_code == 403
        lock.assert_not_called()
    client.force_authenticate(admin)
    from django.db import connection
    with patch("apps.common.concurrency.Tenant.objects.select_for_update", wraps=Tenant.objects.select_for_update) as lock:
        assert client.patch(endpoint, {"name": "Allowed"}).status_code == 200
        lock.assert_called_once()
        assert connection.in_atomic_block


def test_budget_line_cannot_change_currency_with_existing_expenses(setup):
    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project)
    other_project = Project.objects.create(tenant=tenant, name="USD project", code="USD")
    other_budget = Budget.objects.create(tenant=tenant, project=other_project, currency="USD")
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, category="Labor", label="Work", amount=10)
    expense = Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, 10, 29), amount_excluding_tax=10, amount_including_tax=10, currency="BIF")
    url = f"/api/v1/budget/budget-lines/{line.pk}/"
    payload = {"budget": str(other_budget.pk), "currency": "USD"}
    assert client.patch(url, payload).status_code == 400
    assert client.delete(f"/api/v1/budget/expenses/{expense.pk}/").status_code == 204
    assert client.patch(url, payload).status_code == 400


def test_workforce_constraints_reject_invalid_direct_database_writes(setup):
    from django.db import IntegrityError, transaction

    tenant, _, project, _, _ = setup
    worker = Worker.objects.create(tenant=tenant, first_name="A", last_name="B")
    certification = Certification.objects.create(tenant=tenant, code="C", name="Certification")
    with pytest.raises(IntegrityError), transaction.atomic():
        Worker.objects.filter(pk=worker.pk).update(hourly_rate=-1)
    for normal, overtime in [(-1, 0), (0, -1), (24, 1)]:
        with pytest.raises(IntegrityError), transaction.atomic():
            TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 29), normal_hours=normal, overtime_hours=overtime)
    with pytest.raises(IntegrityError), transaction.atomic():
        WorkerCertification.objects.create(tenant=tenant, worker=worker, certification=certification, issued_at=date(2026, 10, 30), expires_at=date(2026, 10, 29))


def test_collection_metadata_exposes_supported_filters_and_search(setup):
    *_, client = setup
    response = client.options("/api/v1/resources/purchase-orders/")
    assert response.status_code == 200
    assert "supplier" in response.data["filters"]
    assert "order_number" in response.data["search_fields"]
    assert "created_at" in response.data["ordering_fields"]
    response = client.options("/api/v1/workforce/time-entries/")
    assert response.data["search_fields"] == []
    assert "is_validated" in response.data["filters"]


def test_purchase_order_lines_validate_quantity_and_price_on_create_and_patch(setup):
    from apps.resources.models import Material, PurchaseOrder, Supplier

    tenant, _, project, _, client = setup
    supplier = Supplier.objects.create(tenant=tenant, name="Supplier")
    order = PurchaseOrder.objects.create(tenant=tenant, project=project, supplier=supplier, order_number="PO-UX")
    material = Material.objects.create(tenant=tenant, reference="M", name="Material", unit="kg")
    endpoint = "/api/v1/resources/purchase-order-lines/"
    payload = {"purchase_order": str(order.pk), "material": str(material.pk), "quantity": "2.500", "unit_price": "100.50", "currency": "BIF"}
    for quantity, price in [("0", "1"), ("-1", "1"), ("1", "-1")]:
        assert client.post(endpoint, {**payload, "quantity": quantity, "unit_price": price}).status_code == 400
    response = client.post(endpoint, payload)
    assert response.status_code == 201
    url = f"{endpoint}{response.data['id']}/"
    assert client.patch(url, {"unit_price": "-1"}).status_code == 400
    assert client.patch(url, {"quantity": "0"}).status_code == 400
    assert client.patch(url, {"quantity": "0.001", "unit_price": "0"}).status_code == 200


def test_progress_photo_download_is_authenticated_and_tenant_scoped(setup, settings, tmp_path):
    from io import BytesIO
    from PIL import Image
    from apps.progress.models import Photo

    settings.MEDIA_ROOT = tmp_path
    tenant, admin, project, _, client = setup
    content = BytesIO()
    Image.new("RGB", (2, 2)).save(content, format="PNG")
    photo = Photo.objects.create(tenant=tenant, project=project,
        image=SimpleUploadedFile("site.png", content.getvalue(), content_type="image/png"))
    endpoint = f"/api/v1/progress/photos/{photo.pk}/download/"
    response = client.get(endpoint)
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == content.getvalue()
    response.close()
    outsider, _ = member(tenant, permissions={"progress": []})
    client.force_authenticate(outsider)
    assert client.get(endpoint).status_code == 403
    foreign = Tenant.objects.create(name="Foreign", slug="foreign-photos")
    client.force_authenticate(admin)
    client.credentials(HTTP_X_TENANT_ID=str(foreign.pk))
    assert client.get(endpoint).status_code == 404
    client.force_authenticate(None)
    assert client.get(endpoint).status_code == 401


def test_role_directory_supports_sharing_without_exposing_permissions(setup):
    tenant, _, _, _, client = setup
    user, role = member(tenant, permissions={"documents": ["crud"]})
    foreign = Tenant.objects.create(name="Foreign", slug="foreign-roles")
    Role.objects.create(tenant=foreign, code="secret", name="Secret", permissions={"*": ["crud"]})
    client.force_authenticate(user)
    assert client.get("/api/v1/auth/roles/").status_code == 403
    response = client.get("/api/v1/auth/role-directory/")
    assert response.status_code == 200
    assert str(role.pk) in {str(item["id"]) for item in response.data}
    assert all(set(item) == {"id", "code", "name"} and item["name"] != "Secret" for item in response.data)


def test_json_metadata_and_role_permissions_preserve_structured_values(setup):
    *_, client = setup
    metadata = client.options("/api/v1/auth/roles/").data
    assert metadata["actions"]["POST"]["permissions"]["type"] == "json"
    template = client.options("/api/v1/qhse/inspection-templates/").data
    assert template["actions"]["POST"]["items"]["type"] == "json"
    payload = {"code": "custom", "name": "Custom", "permissions": {"projects": ["read"]}}
    response = client.post("/api/v1/auth/roles/", payload, format="json")
    assert response.status_code == 201
    assert response.data["permissions"] == {"projects": ["read"]}
    for invalid in ['{"projects":["read"]}', ["read"], {"projects": "read"}]:
        assert client.patch(f"/api/v1/auth/roles/{response.data['id']}/", {"permissions": invalid}, format="json").status_code == 400


def test_order_transitions_lock_header_lines_and_parent_deletion(setup):
    from apps.resources.models import Material, PurchaseOrder, StockMovement, Supplier

    tenant, _, project, _, client = setup
    supplier = Supplier.objects.create(tenant=tenant, name="Supplier")
    material = Material.objects.create(tenant=tenant, name="Cement", reference="C", unit="sac")
    order = PurchaseOrder.objects.create(tenant=tenant, project=project, supplier=supplier, order_number="PO-LIFECYCLE")
    url = f"/api/v1/resources/purchase-orders/{order.pk}/"
    transition = url + "transition-status/"
    assert client.post(transition, {"to_status": "sent"}).status_code == 400
    assert client.patch(url, {"status": "sent"}).status_code == 400
    line_payload = {"purchase_order": str(order.pk), "material": str(material.pk), "quantity": "2.500", "unit_price": "10.00", "currency": "BIF"}
    response = client.post("/api/v1/resources/purchase-order-lines/", line_payload)
    assert response.status_code == 201, response.data
    assert response.data["unit"] == "sac"
    line_url = f"/api/v1/resources/purchase-order-lines/{response.data['id']}/"
    assert client.post(transition, {"to_status": "sent"}, HTTP_IF_MATCH='"1"').status_code == 200
    order.refresh_from_db()
    assert order.status == "sent" and order.version == 2
    assert client.patch(url, {"order_number": "CHANGED"}).status_code == 400
    assert client.post("/api/v1/resources/purchase-order-lines/", line_payload).status_code == 400
    assert client.patch(line_url, {"quantity": "3"}).status_code == 400
    for endpoint in [line_url, url, f"/api/v1/projects/{project.pk}/", f"/api/v1/resources/suppliers/{supplier.pk}/"]:
        assert client.delete(endpoint).status_code == 400
    assert client.post(transition, {"to_status": "cancelled"}, HTTP_IF_MATCH='"1"').status_code == 409
    assert client.post(transition, {"to_status": "partially_received"}, HTTP_IF_MATCH='"2"').status_code == 200
    assert client.post(transition, {"to_status": "cancelled"}).status_code == 400
    assert client.post(transition, {"to_status": "received"}).status_code == 200
    assert client.post(transition, {"to_status": "draft"}).status_code == 400
    assert not StockMovement.objects.exists()


def test_order_line_cannot_move_between_orders_and_actions_require_update(setup):
    from apps.resources.models import Material, PurchaseOrder, Supplier

    tenant, _, project, _, client = setup
    supplier = Supplier.objects.create(tenant=tenant, name="Supplier")
    material = Material.objects.create(tenant=tenant, name="Cement", reference="C", unit="sac")
    orders = [PurchaseOrder.objects.create(tenant=tenant, project=project, supplier=supplier, order_number=number) for number in ["PO1", "PO2"]]
    payload = {"purchase_order": str(orders[0].pk), "material": str(material.pk), "quantity": "1", "unit_price": "10"}
    line = client.post("/api/v1/resources/purchase-order-lines/", payload).data
    assert client.patch(f"/api/v1/resources/purchase-order-lines/{line['id']}/", {"purchase_order": str(orders[1].pk)}).status_code == 400
    user, _ = member(tenant, permissions={"resources": ["read"]})
    client.force_authenticate(user)
    assert client.post(f"/api/v1/resources/purchase-orders/{orders[0].pk}/transition-status/", {"to_status": "sent"}).status_code == 403


def test_budget_line_totals_and_expenses_are_scoped_to_budget(setup):
    from django.utils import timezone

    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project, currency="USD")
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, category="Work", label="Structure", amount=1000, currency="USD")
    other_project = Project.objects.create(tenant=tenant, code="OTHER", name="Other")
    other_budget = Budget.objects.create(tenant=tenant, project=other_project, currency="USD")
    other_line = BudgetLine.objects.create(tenant=tenant, budget=other_budget, category="Work", label="Other", amount=500, currency="USD")
    own = []
    for target, amount, status, deleted in [(line, 120, "validated", False), (line, 30, "paid", False), (line, 99, "draft", False), (line, 10, "validated", True), (other_line, 200, "validated", False)]:
        expense = Expense.objects.create(tenant=tenant, budget_line=target, date=date(2026, 10, 29), amount_excluding_tax=amount, amount_including_tax=amount, currency="USD", status=status, deleted_at=timezone.now() if deleted else None)
        if target == line and not deleted:
            own.append(str(expense.pk))
    response = client.get(f"/api/v1/budget/budget-lines/?budget={budget.pk}")
    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["spent"] == "150.00"
    assert response.data["results"][0]["remaining"] == "850.00"
    assert response.data["results"][0]["project_name"] == project.name
    result = client.get(f"/api/v1/budget/expenses/?budget={budget.pk}")
    assert {str(row["id"]) for row in result.data["results"]} == set(own)
    assert client.get("/api/v1/budget/expenses/?budget=not-a-uuid").status_code == 400
    summary = client.get(f"/api/v1/budget/budgets/{budget.pk}/summary/").data
    assert summary["spent"] == 150 and summary["remaining"] == 850
