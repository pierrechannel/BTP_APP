from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class User(AbstractUser):
    email = models.EmailField(unique=True)
    language = models.CharField(max_length=8, default="fr")
    timezone = models.CharField(max_length=64, default="Africa/Bujumbura")
    preferred_currency = models.CharField(max_length=3, default="BIF")
    avatar = models.ImageField(upload_to="avatars/", blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return self.email


class Tenant(UUIDModel, TimestampedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    default_currency = models.CharField(max_length=3, default="BIF")
    country = models.CharField(max_length=2, default="BI")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Role(UUIDModel, TimestampedModel):
    ADMIN = "admin"
    WORKS_MANAGER = "works_manager"
    SITE_MANAGER = "site_manager"
    WORKER = "worker"
    CLIENT = "client"
    SUBCONTRACTOR = "subcontractor"

    ROLE_CHOICES = [
        (ADMIN, "Admin"),
        (WORKS_MANAGER, "Conducteur de travaux"),
        (SITE_MANAGER, "Chef de chantier"),
        (WORKER, "Ouvrier"),
        (CLIENT, "Client"),
        (SUBCONTRACTOR, "Sous-traitant"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="roles")
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=120)
    permissions = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="unique_role_code_per_tenant")
        ]
        ordering = ["tenant__name", "name"]

    def __str__(self) -> str:
        return f"{self.tenant} - {self.name}"


class Membership(UUIDModel, TimestampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="memberships")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="memberships")
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "tenant"], name="unique_user_membership_per_tenant")
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.tenant}"


class AuditLog(UUIDModel):
    tenant = models.ForeignKey(Tenant, null=True, blank=True, on_delete=models.SET_NULL)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=120)
    resource_type = models.CharField(max_length=120, blank=True)
    resource_id = models.CharField(max_length=120, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Device(UUIDModel, TimestampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="devices")
    name = models.CharField(max_length=120)
    platform = models.CharField(max_length=50)
    push_token = models.TextField(blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
