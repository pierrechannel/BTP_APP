from apps.common.viewsets import TenantModelViewSet
from apps.resources.models import Material, Supplier
from apps.resources.serializers import MaterialSerializer, SupplierSerializer


class MaterialViewSet(TenantModelViewSet):
    queryset = Material.objects.select_related("tenant")
    serializer_class = MaterialSerializer
    filterset_fields = ["currency", "unit"]
    search_fields = ["reference", "name"]


class SupplierViewSet(TenantModelViewSet):
    queryset = Supplier.objects.select_related("tenant")
    serializer_class = SupplierSerializer
    search_fields = ["name", "email", "phone"]
