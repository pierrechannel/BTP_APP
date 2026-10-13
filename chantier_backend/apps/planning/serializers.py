from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.planning.models import Task, TaskDependency


class TaskSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS

    def validate_progress_percent(self, value):
        if value > 100:
            raise serializers.ValidationError("Le pourcentage d'avancement ne peut pas depasser 100.")
        return value


class TaskDependencySerializer(TenantOwnedModelSerializer):
    class Meta:
        model = TaskDependency
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
