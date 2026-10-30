import uuid

from django.conf import settings
from django.db import models

from apps.common.identifiers import AUTOMATIC_IDENTIFIERS


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TenantOwnedModel(UUIDModel, TimestampedModel):
    tenant = models.ForeignKey("accounts.Tenant", on_delete=models.PROTECT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    def save(self, *args, **kwargs):
        identifier = AUTOMATIC_IDENTIFIERS.get(self._meta.label_lower)
        if identifier:
            field, prefix = identifier
            if self._state.adding and not getattr(self, field):
                # The full primary UUID avoids counters racing across requests.
                setattr(self, field, f"{prefix}-{self.pk.hex.upper()}")
                if kwargs.get("update_fields") is not None:
                    kwargs["update_fields"] = set(kwargs["update_fields"]) | {field}
        return super().save(*args, **kwargs)

    class Meta:
        abstract = True
