from rest_framework import generics

from .models import Expedition
from .serializers import ExpeditionSerializer


class PublishedExpeditionList(generics.ListAPIView):
    serializer_class = ExpeditionSerializer

    def get_queryset(self):
        return Expedition.objects.filter(status=Expedition.Status.PUBLISHED).prefetch_related("reservations")


class PublishedExpeditionDetail(generics.RetrieveAPIView):
    serializer_class = ExpeditionSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Expedition.objects.filter(status=Expedition.Status.PUBLISHED).prefetch_related("reservations")
