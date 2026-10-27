from django.shortcuts import get_object_or_404
from uuid import UUID
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import AuditLog, Tenant
from apps.common.concurrency import VersionedWriteMixin
from apps.common.services import soft_delete
from apps.common.permissions import (
    HasRolePermission,
    HasTenantContext,
    IsTenantMember,
    TenantObjectPermission,
)


class TenantModelViewSet(VersionedWriteMixin, ModelViewSet):
    permission_classes = [
        IsAuthenticated,
        HasTenantContext,
        IsTenantMember,
        HasRolePermission,
        TenantObjectPermission,
    ]
    ordering_fields = ["created_at", "updated_at"]
    permission_action_map = {
        "update_progress": "update", "update_state": "update", "transition_status": "update",
        "submit": "update", "mark_read": "update", "mark_current": "update",
        "approve": "validate", "reject": "validate", "validate": "validate",
        "close": "update", "complete": "update", "summary": "read", "run": "create",
        "mark_applied": "update", "mark_failed": "update",
        "download": "read",
        "resolve": "update",
        "pay": "validate",
        "stock": "read",
    }

    def perform_destroy(self, instance):
        if not hasattr(instance, "deleted_at"):
            instance.delete()
            return
        soft_delete(instance, self.request.user)

    @property
    def resource_name(self):
        model = getattr(getattr(self, "queryset", None), "model", None)
        return getattr(getattr(model, "_meta", None), "app_label", None)

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        queryset = queryset.filter(tenant_id=self.request.tenant_id)
        if hasattr(queryset.model, "deleted_at"):
            queryset = queryset.filter(deleted_at__isnull=True)
        for field in queryset.model._meta.fields:
            if field.is_relation and hasattr(field.related_model, "deleted_at"):
                queryset = queryset.filter(**{f"{field.name}__deleted_at__isnull": True})
        project_id = self.request.query_params.get("project")
        if project_id:
            try:
                UUID(project_id)
            except ValueError as exc:
                raise ValidationError({"project": "Identifiant de chantier invalide."}) from exc
            scope = {
                "budget.budgetline": "budget__project_id",
                "budget.expense": "budget_line__budget__project_id",
                "planning.taskdependency": "predecessor__project_id",
                "documents.document": "folder__project_id",
                "documents.documentversion": "document__folder__project_id",
                "documents.documentacl": "document__folder__project_id",
                "documents.approvalworkflow": "document__folder__project_id",
                "resources.purchaseorderline": "purchase_order__project_id",
                "qhse.correctiveaction": "incident__project_id",
                "qhse.inspectionitem": "inspection__project_id",
            }.get(queryset.model._meta.label_lower)
            if any(field.name == "project" for field in queryset.model._meta.fields):
                scope = "project_id"
            if scope:
                queryset = queryset.filter(**{scope: project_id})
        return queryset

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        data = getattr(response, "data", None)
        if isinstance(data, dict) and "version" in data and response.status_code < 300:
            response["ETag"] = f'"{data["version"]}"'
        if (request.method in {"POST", "PUT", "PATCH", "DELETE"}
                and response.status_code < 300 and request.user.is_authenticated):
            AuditLog.objects.create(
                tenant_id=request.tenant_id, user=request.user,
                action=self.action, resource_type=self.resource_name,
                resource_id=str(self.kwargs.get("pk") or (data or {}).get("id", "")),
                correlation_id=str(getattr(request, "correlation_id", ""))[:64],
            )
        return response

    def perform_create(self, serializer):
        tenant = get_object_or_404(Tenant, id=self.request.tenant_id, is_active=True)
        save_kwargs = {"tenant": tenant}
        model_fields = {field.name for field in serializer.Meta.model._meta.fields}
        if "created_by" in model_fields:
            save_kwargs["created_by"] = self.request.user
        if "updated_by" in model_fields:
            save_kwargs["updated_by"] = self.request.user
        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        save_kwargs = {}
        model_fields = {field.name for field in serializer.Meta.model._meta.fields}
        if "updated_by" in model_fields:
            save_kwargs["updated_by"] = self.request.user
        if "version" in model_fields:
            save_kwargs["version"] = getattr(instance, "version", 0) + 1
        serializer.save(**save_kwargs)
