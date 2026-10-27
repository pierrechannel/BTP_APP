from types import SimpleNamespace

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.common.concurrency import VersionConflict
from apps.common.permissions import HasRolePermission
from apps.common.services import soft_delete
from apps.planning.models import Task
from apps.planning.serializers import TaskSerializer
from apps.progress.models import DailyReport
from apps.progress.serializers import DailyReportSerializer
from apps.sync.models import SyncMutation

# Explicit allowlist: never resolve arbitrary model names supplied by a client.
SYNC_RESOURCES = {
    "planning.task": (Task, TaskSerializer),
    "progress.daily_report": (DailyReport, DailyReportSerializer),
}


@transaction.atomic
def mark_mutation_applied(mutation: SyncMutation, user) -> SyncMutation:
    from apps.accounts.models import AuditLog, Tenant
    Tenant.objects.select_for_update().get(pk=mutation.tenant_id)
    mutation = SyncMutation.objects.select_for_update().get(pk=mutation.pk)
    if mutation.status == "applied":
        return mutation
    if mutation.resource_type not in SYNC_RESOURCES:
        raise ValidationError({"resource_type": "Ressource non prise en charge pour la synchronisation."})
    if mutation.operation not in {"create", "update", "upsert", "delete"}:
        raise ValidationError({"operation": "Operation invalide."})
    if not isinstance(mutation.payload, dict):
        raise ValidationError({"payload": "Un objet JSON est requis."})
    model, serializer_class = SYNC_RESOURCES[mutation.resource_type]
    instance = model.objects.filter(pk=mutation.resource_id, tenant_id=mutation.tenant_id).first()
    action = mutation.operation
    if action == "upsert":
        action = "update" if instance else "create"
    request = SimpleNamespace(user=user, tenant_id=str(mutation.tenant_id), method="POST")
    view = SimpleNamespace(resource_name=model._meta.app_label, action=action)
    if not HasRolePermission().has_permission(request, view):
        raise PermissionDenied("Role insuffisant pour modifier cette ressource.")
    if instance and instance.deleted_at:
        raise VersionConflict("Cette ressource a ete supprimee.")
    if action == "create" and instance:
        raise VersionConflict("Cette ressource existe deja.")
    if action != "create" and not instance:
        raise ValidationError({"resource_id": "Ressource introuvable dans le tenant courant."})
    if action == "create" and mutation.resource_id and model.objects.filter(pk=mutation.resource_id).exists():
        raise ValidationError({"resource_id": "Identifiant indisponible."})
    payload = dict(mutation.payload)
    expected = payload.pop("expected_version", None)
    if instance and (type(expected) is not int or expected != instance.version):
        raise VersionConflict()
    if action == "delete":
        soft_delete(instance, user)
    else:
        serializer = serializer_class(instance, data=payload, partial=action == "update", context={"request": request})
        serializer.is_valid(raise_exception=True)
        kwargs = {"updated_by": user}
        if instance:
            kwargs["version"] = instance.version + 1
        else:
            kwargs.update(tenant=mutation.tenant, created_by=user)
            if mutation.resource_id:
                kwargs["id"] = mutation.resource_id
        instance = serializer.save(**kwargs)
    mutation.resource_id = instance.pk
    mutation.status = "applied"
    mutation.error = {}
    mutation.updated_by = user
    mutation.version += 1
    mutation.save(update_fields=["resource_id", "status", "error", "updated_by", "version", "updated_at"])
    AuditLog.objects.create(tenant=mutation.tenant, user=user, action=f"sync_{action}",
                            resource_type=mutation.resource_type, resource_id=str(instance.pk))
    return mutation


def mark_mutation_failed(mutation: SyncMutation, error: dict, user) -> SyncMutation:
    if mutation.status == "applied":
        raise ValidationError("Une mutation appliquee ne peut pas etre declaree en echec.")
    if not isinstance(error, dict):
        raise ValidationError({"error": "Un objet JSON est requis."})
    mutation.status = "failed"
    mutation.error = error
    mutation.updated_by = user
    mutation.version += 1
    mutation.save(update_fields=["status", "error", "updated_by", "version", "updated_at"])
    return mutation
