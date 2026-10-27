from rest_framework import serializers

from apps.accounts.models import AuditLog, Device, Membership, Role, Tenant, User
from apps.common.serializers import TenantValidationMixin


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ["id", "name", "slug", "default_currency", "country", "is_active"]


class MembershipSerializer(serializers.ModelSerializer):
    tenant = TenantSerializer(read_only=True)
    role = serializers.CharField(source="role.code", read_only=True)
    permissions = serializers.JSONField(source="role.permissions", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "tenant", "role", "permissions", "is_active"]


class UserMeSerializer(serializers.ModelSerializer):
    memberships = MembershipSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "language",
            "timezone",
            "preferred_currency",
            "memberships",
            "is_superuser",
        ]


class UserSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        user = User(**validated_data)
        user.set_unusable_password()
        user.save()
        return user

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "language",
            "timezone",
            "preferred_currency",
            "is_active",
        ]
        read_only_fields = ["id"]


class RoleSerializer(TenantValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "tenant", "code", "name", "permissions", "created_at", "updated_at"]
        read_only_fields = ["id", "tenant", "created_at", "updated_at"]


class MembershipWriteSerializer(TenantValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Membership
        fields = ["id", "user", "tenant", "role", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "tenant", "created_at", "updated_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class DeviceSerializer(TenantValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ["id", "tenant", "user", "name", "platform", "push_token", "last_seen_at", "is_active"]
        read_only_fields = ["id", "tenant"]
