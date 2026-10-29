from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError

from apps.accounts.models import Tenant


class VersionConflict(APIException):
    status_code = 409
    default_detail = "La ressource a ete modifiee. Rechargez-la avant de recommencer."
    default_code = "version_conflict"


class VersionedWriteMixin:
    """Lock tenant writes only after authentication and view permissions pass.

    If-Match is optional for legacy clients. When supplied, stale writes fail.
    Serializing tenant writes also protects graph validation on PostgreSQL.
    """

    def dispatch(self, request, *args, **kwargs):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return super().dispatch(request, *args, **kwargs)
        tenant_id = request.META.get("HTTP_X_TENANT_ID")
        try:
            UUID(str(tenant_id))
        except (ValueError, TypeError):
            return super().dispatch(request, *args, **kwargs)
        with transaction.atomic():
            response = super().dispatch(request, *args, **kwargs)
            if response.status_code >= 400:
                transaction.set_rollback(True)
            return response

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            tenant_id = getattr(request, "tenant_id", None)
            try:
                UUID(str(tenant_id))
            except (ValueError, TypeError):
                return
            Tenant.objects.select_for_update().filter(pk=tenant_id).first()

    def get_object(self):
        obj = super().get_object()
        if self.request.method in {"POST", "PUT", "PATCH", "DELETE"} and hasattr(obj, "version"):
            expected = self.request.headers.get("If-Match")
            if expected is not None:
                try:
                    expected = int(expected.strip('"'))
                except ValueError as exc:
                    raise ValidationError({"If-Match": "Une version entiere est requise."}) from exc
                if expected != obj.version:
                    raise VersionConflict()
        return obj
