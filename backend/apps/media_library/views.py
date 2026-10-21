from django.core.files.uploadhandler import FileUploadHandler
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.urls import reverse
from rest_framework import permissions, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.operations.authentication import OperationsAuthentication
from .models import MediaAsset
from .services import MAX_FILE_BYTES, UploadTooLarge, asset_path, create_asset


class BoundedUploadHandler(FileUploadHandler):
    """Bound bytes before Django can spool an arbitrarily large file to /tmp."""

    def __init__(self, request):
        super().__init__(request)
        self.received = 0

    def receive_data_chunk(self, raw_data, start):
        self.received += len(raw_data)
        if self.received > MAX_FILE_BYTES:
            raise UploadTooLarge()
        return raw_data

    def file_complete(self, file_size):
        return None


class UploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class MediaPagination(PageNumberPagination):
    page_size = 24


def asset_payload(asset):
    return {
        "id": str(asset.id), "name": asset.original_name,
        "url": reverse("media-content", args=[asset.id, "image"]),
        "thumbnail_url": reverse("media-content", args=[asset.id, "thumbnail"]),
        "width": asset.width, "height": asset.height,
        "byte_size": asset.byte_size, "created_at": asset.created_at,
    }


class MediaLibraryView(APIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def initialize_request(self, request, *args, **kwargs):
        request.upload_handlers.insert(0, BoundedUploadHandler(request))
        return super().initialize_request(request, *args, **kwargs)

    def get(self, request):
        pagination = MediaPagination()
        page = pagination.paginate_queryset(MediaAsset.objects.all(), request, view=self)
        return pagination.get_paginated_response([asset_payload(asset) for asset in page])

    def post(self, request):
        try:
            declared_size = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            raise UploadTooLarge()
        if declared_size > MAX_FILE_BYTES + 256 * 1024:
            raise UploadTooLarge()
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if len(request.FILES.getlist("file")) != 1 or len(request.FILES) != 1:
            raise serializers.ValidationError("Envie uma imagem por vez.")
        asset = create_asset(serializer.validated_data["file"])
        return Response(asset_payload(asset), status=201)


class MediaContentView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, asset_id, variant):
        if variant not in {"image", "thumbnail"}:
            raise Http404()
        get_object_or_404(MediaAsset, id=asset_id)
        try:
            stream = asset_path(asset_id, variant).open("rb")
        except OSError as error:
            raise Http404() from error
        response = FileResponse(stream, content_type="image/webp")
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        response["X-Content-Type-Options"] = "nosniff"
        return response
