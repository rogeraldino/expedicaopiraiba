from rest_framework import generics

from .models import Expedition, Lodge, TargetSpecies
from .serializers import ExpeditionSerializer, LodgeSerializer, TargetSpeciesSerializer


class PublishedExpeditionList(generics.ListAPIView):
    serializer_class = ExpeditionSerializer

    def get_queryset(self):
        return (
            Expedition.objects.filter(status=Expedition.Status.PUBLISHED)
            .select_related("lodge__river")
            .prefetch_related("reservations", "expedition_species__species", "lodge__amenities_structured")
        )


class PublishedExpeditionDetail(generics.RetrieveAPIView):
    serializer_class = ExpeditionSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return (
            Expedition.objects.filter(status=Expedition.Status.PUBLISHED)
            .select_related("lodge__river")
            .prefetch_related("reservations", "expedition_species__species", "lodge__amenities_structured")
        )


class LodgeListView(generics.ListAPIView):
    serializer_class = LodgeSerializer

    def get_queryset(self):
        return (
            Lodge.objects.filter(active=True)
            .select_related("river")
            .prefetch_related("amenities_structured")
            .order_by("name")
        )


class TargetSpeciesListView(generics.ListAPIView):
    serializer_class = TargetSpeciesSerializer

    def get_queryset(self):
        return TargetSpecies.objects.filter(active=True).order_by("category", "common_name")
