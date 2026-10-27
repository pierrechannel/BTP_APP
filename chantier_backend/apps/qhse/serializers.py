from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionItem,
    InspectionTemplate,
    Ppsps,
)
from rest_framework import serializers


class IncidentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Incident
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class CorrectiveActionSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = CorrectiveAction
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InspectionTemplateSerializer(TenantOwnedModelSerializer):
    def validate_items(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Une liste de points de controle est requise.")
        labels = [item if isinstance(item, str) else item.get("label", "") if isinstance(item, dict) else "" for item in value]
        if any(not isinstance(label, str) or not label.strip() or len(label) > 255 for label in labels):
            raise serializers.ValidationError("Chaque point doit contenir un libelle de 1 a 255 caracteres.")
        return [label.strip() for label in labels]

    class Meta:
        model = InspectionTemplate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InspectionSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance:
            if self.instance.status == Inspection.COMPLETED:
                raise serializers.ValidationError("Une inspection terminee ne peut plus etre modifiee.")
            if "template" in attrs and attrs["template"].pk != self.instance.template_id:
                raise serializers.ValidationError({"template": "Le modele d'une inspection existante ne peut pas changer."})
        elif not attrs["template"].items:
            raise serializers.ValidationError({"template": "Ajoutez des points de controle au modele avant de creer l'inspection."})
        return attrs

    def create(self, validated_data):
        inspection = super().create(validated_data)
        InspectionItem.objects.bulk_create([
            InspectionItem(tenant=inspection.tenant, inspection=inspection,
                           label=item if isinstance(item, str) else item["label"],
                           created_by=inspection.created_by, updated_by=inspection.updated_by)
            for item in inspection.template.items
        ])
        return inspection

    class Meta:
        model = Inspection
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "score"]


class InspectionItemSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        inspection = attrs.get("inspection", getattr(self.instance, "inspection", None))
        if inspection.status == Inspection.COMPLETED:
            raise serializers.ValidationError("Les points d'une inspection terminee ne peuvent plus etre modifies.")
        return attrs

    class Meta:
        model = InspectionItem
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class PpspsSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Ppsps
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
