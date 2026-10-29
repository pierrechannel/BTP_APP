import pytest
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, Membership, Role, Tenant, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def platform():
    admin = User.objects.create_user(username="platform", email="platform@test.local", is_superuser=True)
    client = APIClient()
    client.force_authenticate(admin)
    return admin, client


@pytest.mark.parametrize("collection", ["tenants", "users", "memberships", "roles", "audit"])
def test_platform_collections_require_superadministrator(platform, collection):
    _, client = platform
    endpoint = f"/api/v1/auth/platform/{collection}/"
    assert client.get(endpoint).status_code == 200
    client.force_authenticate(User.objects.create_user(username="ordinary", email="ordinary@test.local"))
    assert client.get(endpoint).status_code == 403
    client.force_authenticate(None)
    assert client.get(endpoint).status_code == 401


def test_platform_tenant_lifecycle_creates_role_and_audit_without_tenant_header(platform):
    _, client = platform
    endpoint = "/api/v1/auth/platform/tenants/"
    response = client.post(endpoint, {"name": "Entreprise", "slug": "entreprise", "country": "bi", "default_currency": "bif"})
    assert response.status_code == 201, response.data
    tenant = Tenant.objects.get(pk=response.data["id"])
    assert tenant.country == "BI" and tenant.default_currency == "BIF"
    assert Role.objects.filter(tenant=tenant, code="admin").exists()
    assert AuditLog.objects.filter(tenant=tenant, action="platform.create").exists()
    assert client.patch(f"{endpoint}{tenant.pk}/", {"is_active": False}).status_code == 200
    tenant.refresh_from_db()
    assert not tenant.is_active
    rows = client.get(endpoint, {"search": "Entreprise", "page_size": 10}).data
    assert rows["count"] == 1
    assert rows["results"][0]["members_count"] == 0
    assert rows["results"][0]["projects_count"] == 0
    assert client.delete(f"{endpoint}{tenant.pk}/").status_code == 405


def test_platform_user_password_and_global_listing(platform):
    admin, client = platform
    endpoint = "/api/v1/auth/platform/users/"
    weak = client.post(endpoint, {"email": "weak@test.local", "username": "weak", "password": "12345678"})
    assert weak.status_code == 400
    assert not User.objects.filter(email="weak@test.local").exists()
    response = client.post(endpoint, {"email": "new@test.local", "username": "new", "password": "Strong!Pass-4826", "is_superuser": True})
    assert response.status_code == 201, response.data
    user = User.objects.get(pk=response.data["id"])
    assert user.check_password("Strong!Pass-4826")
    assert not user.is_superuser
    assert "password" not in response.data
    assert client.get(endpoint).data["count"] == 2
    assert client.patch(f"{endpoint}{admin.pk}/", {"is_active": False}).status_code == 400
    assert client.patch(f"{endpoint}{user.pk}/", {"password": "Another!Pass-9876"}).status_code == 200
    user.refresh_from_db()
    assert user.check_password("Another!Pass-9876")
    assert client.patch(f"{endpoint}{user.pk}/", {"is_active": False}).status_code == 200
    assert client.get(endpoint, {"is_active": False}).data["count"] == 1
    assert "password" not in str(list(AuditLog.objects.values("metadata")))


def test_platform_memberships_reject_cross_tenant_roles_and_can_suspend_access(platform):
    _, client = platform
    user = User.objects.create_user(username="member", email="member@test.local")
    tenant = Tenant.objects.create(name="A", slug="a")
    other = Tenant.objects.create(name="B", slug="b", is_active=False)
    role = Role.objects.create(tenant=tenant, code="admin", name="Admin", permissions={"*": ["crud", "validate"]})
    wrong = Role.objects.create(tenant=other, code="admin", name="Admin B")
    endpoint = "/api/v1/auth/platform/memberships/"
    payload = {"user": user.pk, "tenant": str(tenant.pk), "role": str(wrong.pk)}
    assert client.post(endpoint, payload).status_code == 400
    payload["role"] = str(role.pk)
    response = client.post(endpoint, payload)
    assert response.status_code == 201, response.data
    access = Membership.objects.get(pk=response.data["id"])
    assert client.post(endpoint, payload).status_code == 400
    assert client.get("/api/v1/auth/platform/users/", {"tenant": str(tenant.pk)}).data["count"] == 1
    assert client.get("/api/v1/auth/platform/users/", {"tenant": str(other.pk)}).data["count"] == 0
    assert client.get("/api/v1/auth/platform/roles/", {"tenant": str(other.pk)}).data["count"] == 1
    member_client = APIClient()
    member_client.force_authenticate(user)
    member_client.credentials(HTTP_X_TENANT_ID=str(tenant.pk))
    permitted = member_client.get("/api/v1/projects/")
    assert permitted.status_code == 200, permitted.data
    assert client.patch(f"{endpoint}{access.pk}/", {"is_active": False}).status_code == 200
    assert member_client.get("/api/v1/projects/").status_code == 403
    assert client.get("/api/v1/auth/platform/audit/", {"tenant": str(tenant.pk)}).data["count"] == 2
