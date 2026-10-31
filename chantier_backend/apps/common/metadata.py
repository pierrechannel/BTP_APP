from rest_framework.metadata import SimpleMetadata
from rest_framework import serializers
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Field


class ApplicationMetadata(SimpleMetadata):
    """Expose serializer constraints and related models to the workspace editor."""

    def determine_metadata(self, request, view):
        info = super().determine_metadata(request, view)
        info["filters"] = list(getattr(view, "filterset_fields", []))
        info["search_fields"] = list(getattr(view, "search_fields", []))
        info["ordering_fields"] = list(getattr(view, "ordering_fields", []))
        if hasattr(view, "get_serializer"):
            info["fields"] = self.get_serializer_info(view.get_serializer())
        return info

    def get_field_info(self, field):
        info = super().get_field_info(field)
        if isinstance(field, serializers.JSONField):
            info["type"] = "json"
        info["allow_null"] = getattr(field, "allow_null", False)
        queryset = getattr(field, "queryset", None)
        if queryset is not None:
            info["related_model"] = queryset.model._meta.label_lower
        info["multiline"] = field.style.get("base_template") == "textarea.html"
        parent = getattr(field, "parent", None)
        model = getattr(getattr(parent, "Meta", None), "model", None)
        if model:
            try:
                model_field = model._meta.get_field(field.field_name)
            except FieldDoesNotExist:
                return info
            if isinstance(model_field, Field) and model_field.has_default() and not callable(model_field.default):
                info["default"] = model_field.default
        return info
