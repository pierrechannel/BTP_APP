from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.equipment.models import Equipment
from apps.equipment.serializers import EquipmentSerializer
from apps.equipment.services import update_equipment_state


class EquipmentViewSet(TenantModelViewSet):
    queryset = Equipment.objects.select_related("tenant")
    serializer_class = EquipmentSerializer
    filterset_fields = ["equipment_type", "state", "currency"]
    search_fields = ["name", "serial_number", "equipment_type"]

    @action(detail=True, methods=["post"], url_path="update-state")
    def update_state(self, request, pk=None):
        state = request.data.get("state")
        if not state:
            return Response(
                {"code": "missing_state", "message": "Le champ state est requis.", "details": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        equipment = update_equipment_state(self.get_object(), state, request.user)
        return Response(self.get_serializer(equipment).data)
