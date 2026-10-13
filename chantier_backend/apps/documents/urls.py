from rest_framework.routers import DefaultRouter

from apps.documents.views import (
    ApprovalWorkflowViewSet,
    DocumentAclViewSet,
    DocumentVersionViewSet,
    DocumentViewSet,
    FolderViewSet,
)

router = DefaultRouter()
router.register("folders", FolderViewSet, basename="folder")
router.register("documents", DocumentViewSet, basename="document")
router.register("versions", DocumentVersionViewSet, basename="document-version")
router.register("acls", DocumentAclViewSet, basename="document-acl")
router.register("approval-workflows", ApprovalWorkflowViewSet, basename="approval-workflow")

urlpatterns = router.urls
