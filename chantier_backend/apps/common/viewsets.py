from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import Tenant
from apps.common.permissions import (
    HasRolePermission,
    HasTenantContext,
    IsTenantMember,
    TenantObjectPermission,
)


class TenantModelViewSet(ModelViewSet):
    permission_classes = [
        IsAuthenticated,
        HasTenantContext,
        IsTenantMember,
        HasRolePermission,
        TenantObjectPermission,
    ]
    ordering_fields = ["created_at", "updated_at"]

    @property
    def resource_name(self):
        model = getattr(getattr(self, "queryset", None), "model", None)
        return getattr(getattr(model, "_meta", None), "app_label", None)

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(tenant_id=self.request.tenant_id)
        if hasattr(queryset.model, "deleted_at"):
            queryset = queryset.filter(deleted_at__isnull=True)
        return queryset

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
