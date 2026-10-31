from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.progress.models import DailyReport, Photo, ProgressUpdate, Snag
from rest_framework import serializers
from django.db import transaction
from apps.progress.services import sync_task_progress


class DailyReportSerializer(TenantOwnedModelSerializer):
    workflow_history = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    validator_name = serializers.SerializerMethodField()

    def get_workflow_history(self, instance):
        from apps.progress.services import report_history
        return report_history(instance)

    def get_author_name(self, instance):
        from apps.progress.services import user_label
        return user_label(instance.created_by)

    def get_validator_name(self, instance):
        from apps.progress.services import user_label
        return user_label(instance.validated_by) if instance.validated_by_id else ''
    project_name = serializers.CharField(source='project.name', read_only=True)
    photos = serializers.SerializerMethodField()
    photo_files = serializers.ListField(child=serializers.ImageField(), required=False, write_only=True, max_length=30)
    removed_photos = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)

    def get_photos(self, instance):
        if hasattr(instance, '_active_photos'):
            return [{'id': photo.pk, 'taken_at': photo.taken_at} for photo in instance._active_photos]
        return list(instance.photo_set.filter(tenant_id=instance.tenant_id, deleted_at__isnull=True).values('id', 'taken_at'))

    def validate_photo_files(self, files):
        if any(file.size > 10 * 1024 * 1024 for file in files):
            raise serializers.ValidationError('Chaque photo doit faire au maximum 10 Mo.')
        return files

    def persist_photos(self, report, files, removed):
        from django.utils import timezone
        from django.db.models import F
        user = self.context['request'].user
        if hasattr(report, '_active_photos'):
            del report._active_photos
        report.photo_set.filter(pk__in=removed, tenant_id=report.tenant_id).update(deleted_at=timezone.now(), updated_by=user, version=F('version') + 1)
        stored = []
        try:
            for file in files:
                photo = Photo(tenant=report.tenant, project=report.project, daily_report=report, image=file, created_by=user, updated_by=user)
                stored.append(photo)
                photo.save()
        except Exception:
            for photo in stored:
                if photo.image and photo.image._committed:
                    photo.image.delete(save=False)
            raise
        return report

    @transaction.atomic
    def create(self, validated_data):
        files = validated_data.pop('photo_files', [])
        validated_data.pop('removed_photos', None)
        report = super().create(validated_data)
        from apps.progress.services import user_label
        user = self.context['request'].user
        report.workflow_history = [{'action': 'created', 'at': report.created_at.isoformat(), 'actor': user_label(user), 'actor_id': str(user.pk)}]
        report.save(update_fields=['workflow_history'])
        return self.persist_photos(report, files, [])

    @transaction.atomic
    def update(self, instance, validated_data):
        files = validated_data.pop('photo_files', [])
        removed = validated_data.pop('removed_photos', [])
        return self.persist_photos(super().update(instance, validated_data), files, removed)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status != DailyReport.DRAFT:
            raise serializers.ValidationError('Seul un rapport en brouillon peut être modifié.')
        existing = set(self.instance.photo_set.filter(tenant_id=self.instance.tenant_id, deleted_at__isnull=True).values_list('id', flat=True)) if self.instance else set()
        removed = set(attrs.get('removed_photos', []))
        if not removed.issubset(existing):
            raise serializers.ValidationError({'removed_photos': 'Une photo ne fait pas partie de ce rapport.'})
        if len(existing - removed) + len(attrs.get('photo_files', [])) > 30:
            raise serializers.ValidationError({'photo_files': 'Maximum 30 photos par rapport.'})
        if self.instance and attrs.get('project', self.instance.project) != self.instance.project and existing:
            raise serializers.ValidationError({'project': 'Un rapport avec photos ne peut pas changer de chantier.'})
        return attrs

    class Meta:
        model = DailyReport
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "correction_reason", "submitted_at", "validated_at", "validated_by"]


class PhotoSerializer(TenantOwnedModelSerializer):
    report_status = serializers.CharField(source='daily_report.status', read_only=True, allow_null=True)
    def validate_image(self, image):
        if image.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Une photo doit faire au maximum 10 Mo.')
        return image

    def validate(self, attrs):
        attrs = super().validate(attrs)
        source = self.instance.daily_report if self.instance else None
        target = attrs.get('daily_report', source)
        if any(report and report.status != DailyReport.DRAFT for report in [source, target]):
            raise serializers.ValidationError('Les photos d’un rapport soumis ou validé sont protégées.')
        return attrs

    class Meta:
        model = Photo
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ProgressUpdateSerializer(TenantOwnedModelSerializer):
    progress_percent = serializers.IntegerField(min_value=0, max_value=100)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and attrs.get('task', self.instance.task) != self.instance.task:
            raise serializers.ValidationError({'task': 'Le rattachement d’un relevé existant ne peut pas changer.'})
        task = attrs.get('task', getattr(self.instance, 'task', None))
        if task and task.status == 'cancelled':
            raise serializers.ValidationError({'task': 'Une tâche annulée ne peut pas recevoir de relevé.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        instance = super().create(validated_data)
        sync_task_progress(instance.task, self.context['request'].user)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        sync_task_progress(instance.task, self.context['request'].user)
        return instance

    class Meta:
        model = ProgressUpdate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class SnagSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status == Snag.CLOSED:
            raise serializers.ValidationError('Une réserve clôturée est protégée.')
        return attrs

    class Meta:
        model = Snag
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ['status', 'resolved_at']
