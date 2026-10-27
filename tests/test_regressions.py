from datetime import date
from uuid import uuid4
import json
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, Membership, Role, Tenant, User
from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder
from apps.planning.models import Task, TaskDependency
from apps.projects.models import Lot, Project
from apps.sync.models import SyncMutation
from apps.reports.models import ReportRun, ReportTemplate

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
        content = json.load(report)
    assert content["projects"][0]["code"] == project.code
    assert content["projects"][0]["tasks"]["count"] == 3
    download = client.get(f"/api/v1/reports/runs/{run.pk}/download/")
    assert download.status_code == 200
    download.close()
    client.force_authenticate(None)
    assert client.get(f"/api/v1/reports/runs/{run.pk}/download/").status_code == 401


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
