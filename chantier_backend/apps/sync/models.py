from django.db import models

from apps.common.models import TenantOwnedModel


class SyncMutation(TenantOwnedModel):
    client_mutation_id = models.UUIDField()
    device = models.ForeignKey("accounts.Device", null=True, blank=True, on_delete=models.SET_NULL)
    resource_type = models.CharField(max_length=120)
    resource_id = models.UUIDField(null=True, blank=True)
    operation = models.CharField(max_length=40)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=40, default="pending")
    error = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "client_mutation_id"],
                name="unique_sync_mutation_per_tenant",
            )
        ]
