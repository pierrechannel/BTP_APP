from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.planning.models import Task, TaskDependency
from apps.planning.services import validate_dependency


class TaskSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        def value(name):
            return attrs.get(name, getattr(self.instance, name, None))
        project, lot, parent = value("project"), value("lot"), value("parent")
        if lot and lot.project_id != project.id:
            raise serializers.ValidationError({"lot": "Le lot doit appartenir au meme projet."})
        if parent and parent.project_id != project.id:
            raise serializers.ValidationError({"parent": "La tache parente doit appartenir au meme projet."})
        visited = {self.instance.pk} if self.instance else set()
        ancestor = parent
        while ancestor:
            if ancestor.pk in visited:
                raise serializers.ValidationError({"parent": "Hierarchie circulaire interdite."})
            visited.add(ancestor.pk)
            ancestor = ancestor.parent
        start, end = value("planned_start_date"), value("planned_end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"planned_end_date": "La fin doit suivre le debut."})
        if self.instance and project.pk != self.instance.project_id:
            if self.instance.children.filter(deleted_at__isnull=True).exists() or (
                self.instance.predecessor_links.filter(deleted_at__isnull=True).exists()
                or self.instance.successor_links.filter(deleted_at__isnull=True).exists()
            ):
                raise serializers.ValidationError({"project": "Retirez les liens avant de changer de projet."})
        progress = value("progress_percent") or 0
        status = value("status") or Task.TODO
        if progress == 100:
            attrs["status"] = Task.DONE
        elif progress > 0 and status == Task.TODO:
            attrs["status"] = Task.IN_PROGRESS
        elif status == Task.DONE:
            if "status" in attrs:
                raise serializers.ValidationError({"status": "Une tache terminee doit etre a 100 %."})
            attrs["status"] = Task.IN_PROGRESS if progress else Task.TODO
        return attrs

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS

    def validate_progress_percent(self, value):
        if value > 100:
            raise serializers.ValidationError("Le pourcentage d'avancement ne peut pas depasser 100.")
        return value


class TaskDependencySerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        def value(name, default=None):
            return attrs.get(name, getattr(self.instance, name, default))
        try:
            validate_dependency(value("predecessor"), value("successor"),
                                value("dependency_type", TaskDependency.FINISH_START),
                                getattr(self.instance, "pk", None))
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return attrs

    class Meta:
        model = TaskDependency
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
