from rest_framework import serializers
from django.db.models import Sum

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.workforce.models import Assignment, Certification, TimeEntry, Worker, WorkerCertification


class WorkerSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        basis = attrs.get("payment_basis", getattr(self.instance, "payment_basis", "hourly"))
        field = {"daily": "daily_rate", "monthly": "monthly_rate"}.get(basis)
        if field and attrs.get(field, getattr(self.instance, field, None)) is None:
            raise serializers.ValidationError({field: "Renseignez le tarif du mode choisi."})
        return attrs

    class Meta:
        model = Worker
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class TimeEntrySerializer(TenantOwnedModelSerializer):
    class Meta:
        model = TimeEntry
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["is_validated"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.is_validated:
            raise serializers.ValidationError("Un pointage valide ne peut plus etre modifie.")
        normal = attrs.get("normal_hours", getattr(self.instance, "normal_hours", 0))
        overtime = attrs.get("overtime_hours", getattr(self.instance, "overtime_hours", 0))
        if normal < 0 or overtime < 0:
            raise serializers.ValidationError("Les heures ne peuvent pas etre negatives.")
        if normal + overtime > 24:
            raise serializers.ValidationError("Le total journalier ne peut pas depasser 24 heures.")
        worker = attrs.get("worker", getattr(self.instance, "worker", None))
        work_date = attrs.get("work_date", getattr(self.instance, "work_date", None))
        entries = TimeEntry.objects.filter(
            tenant_id=worker.tenant_id, worker=worker, work_date=work_date,
            deleted_at__isnull=True,
        )
        if self.instance:
            entries = entries.exclude(pk=self.instance.pk)
        total = entries.aggregate(hours=Sum("normal_hours") + Sum("overtime_hours"))["hours"] or 0
        if total + normal + overtime > 24:
            raise serializers.ValidationError("Le total du travailleur pour cette journee ne peut pas depasser 24 heures.")
        return attrs


class CertificationSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Certification
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class WorkerCertificationSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        issued = attrs.get("issued_at", getattr(self.instance, "issued_at", None))
        expires = attrs.get("expires_at", getattr(self.instance, "expires_at", None))
        if issued and expires and expires < issued:
            raise serializers.ValidationError({"expires_at": "L'expiration doit suivre la delivrance."})
        return attrs

    class Meta:
        model = WorkerCertification
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class AssignmentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
