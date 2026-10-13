from rest_framework.routers import DefaultRouter

from apps.documents.views import DocumentVersionViewSet, DocumentViewSet, FolderViewSet

router = DefaultRouter()
router.register("folders", FolderViewSet, basename="folder")
router.register("documents", DocumentViewSet, basename="document")
router.register("versions", DocumentVersionViewSet, basename="document-version")

urlpatterns = router.urls
