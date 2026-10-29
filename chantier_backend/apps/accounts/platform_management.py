"""Global administration endpoints, independent of the selected tenant."""
from django.contrib.auth.password_validation import (
    CommonPasswordValidator, MinimumLengthValidator, NumericPasswordValidator,
    UserAttributeSimilarityValidator, get_default_password_validators, validate_password,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import mixins, serializers, viewsets
from rest_framework.pagination import PageNumberPagination

from apps.accounts.models import AuditLog, Membership, Role, Tenant, User
from apps.accounts.platform import IsPlatformAdministrator
from apps.accounts.serializers import AuditLogSerializer, TenantSerializer
from rest_framework.permissions import IsAuthenticated


class PlatformPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


class PlatformWrites:
    def audit(self, instance, action):
        tenant = instance if isinstance(instance, Tenant) else getattr(instance, "tenant", None)
        AuditLog.objects.create(tenant=tenant, user=self.request.user, action=f"platform.{action}",
            resource_type=instance._meta.label, resource_id=str(instance.pk),
            correlation_id=str(getattr(self.request, "correlation_id", ""))[:64])

    @transaction.atomic
    def perform_create(self, serializer):
        self.audit(serializer.save(), "create")

    @transaction.atomic
    def perform_update(self, serializer):
        self.audit(serializer.save(), "update")


class PlatformBaseViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdministrator]
    pagination_class = PlatformPagination


class PlatformTenantSerializer(TenantSerializer):
    is_active = serializers.BooleanField(default=True)
    members_count = serializers.IntegerField(read_only=True)
    projects_count = serializers.IntegerField(read_only=True)

    def validate_country(self, value):
        if len(value) != 2 or not value.isalpha():
            raise serializers.ValidationError("Utilisez un code pays de deux lettres.")
        return value.upper()

    def validate_default_currency(self, value):
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Utilisez un code devise de trois lettres.")
        return value.upper()

    class Meta(TenantSerializer.Meta):
        fields = TenantSerializer.Meta.fields + ["members_count", "projects_count", "created_at"]
        read_only_fields = ["id", "created_at"]


class PlatformTenantViewSet(PlatformWrites, mixins.CreateModelMixin, mixins.UpdateModelMixin, PlatformBaseViewSet):
    queryset = Tenant.objects.annotate(
        members_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
        projects_count=Count("project", filter=Q(project__deleted_at__isnull=True), distinct=True),
    ).order_by("name", "id")
    serializer_class = PlatformTenantSerializer
    search_fields = ["name", "slug"]
    filterset_fields = ["is_active", "country"]

    @transaction.atomic
    def perform_create(self, serializer):
        tenant = serializer.save()
        Role.objects.create(tenant=tenant, code=Role.ADMIN, name="Administrateur", permissions={"*": ["crud", "validate"]})
        self.audit(tenant, "create")


class PlatformUserSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, trim_whitespace=False)
    memberships_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "first_name", "last_name", "language", "timezone", "preferred_currency", "is_active", "is_superuser", "date_joined", "memberships_count", "password"]
        read_only_fields = ["id", "is_superuser", "date_joined"]

    def validate(self, attrs):
        if self.instance and self.instance.pk == self.context["request"].user.pk and attrs.get("is_active") is False:
            raise serializers.ValidationError({"is_active": "Vous ne pouvez pas désactiver votre propre compte."})
        if "password" in attrs:
            candidate = User(**{name: attrs.get(name, getattr(self.instance, name, "")) for name in ("username", "email", "first_name", "last_name")})
            try:
                validators = get_default_password_validators() or [
                    MinimumLengthValidator(), UserAttributeSimilarityValidator(),
                    CommonPasswordValidator(), NumericPasswordValidator(),
                ]
                validate_password(attrs["password"], user=candidate, password_validators=validators)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for name, value in validated_data.items():
            setattr(instance, name, value)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance


class PlatformUserViewSet(PlatformWrites, mixins.CreateModelMixin, mixins.UpdateModelMixin, PlatformBaseViewSet):
    queryset = User.objects.annotate(memberships_count=Count("memberships", distinct=True)).order_by("-date_joined", "id")
    serializer_class = PlatformUserSerializer
    search_fields = ["email", "username", "first_name", "last_name"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        queryset = super().get_queryset()
        tenant = self.request.query_params.get("tenant")
        if tenant:
            tenant_id = serializers.UUIDField().run_validation(tenant)
            queryset = queryset.filter(memberships__tenant_id=tenant_id).distinct()
        return queryset


class PlatformMembershipSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "tenant", "tenant_name", "role", "role_name", "is_active"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", None))
        tenant = attrs.get("tenant", getattr(self.instance, "tenant", None))
        if role and tenant and role.tenant_id != tenant.pk:
            raise serializers.ValidationError({"role": "Le rôle doit appartenir à l’entreprise choisie."})
        return attrs


class PlatformMembershipViewSet(PlatformWrites, mixins.CreateModelMixin, mixins.UpdateModelMixin, PlatformBaseViewSet):
    queryset = Membership.objects.select_related("tenant", "role", "user").order_by("tenant__name", "id")
    serializer_class = PlatformMembershipSerializer
    filterset_fields = ["tenant", "user", "is_active"]


class PlatformRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "tenant", "name", "code"]


class PlatformRoleViewSet(PlatformBaseViewSet):
    queryset = Role.objects.order_by("name", "id")
    serializer_class = PlatformRoleSerializer
    filterset_fields = ["tenant"]


class PlatformAuditViewSet(PlatformBaseViewSet):
    queryset = AuditLog.objects.select_related("user", "tenant").order_by("-created_at", "id")
    serializer_class = AuditLogSerializer
    filterset_fields = ["tenant", "user", "action", "resource_type"]
    search_fields = ["action", "resource_type", "resource_id", "correlation_id"]
