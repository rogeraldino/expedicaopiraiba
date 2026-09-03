from django.db.models import Count, F, IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expeditions.models import Expedition
from apps.payments.models import Payment
from apps.payments.models import PaymentTransaction
from apps.customers.models import Customer, VerificationChallenge
from apps.reservations.models import Reservation, ReservationParticipant

from .authentication import OperationsAuthentication, create_admin_token, validate_credentials
from .serializers import OperationsExpeditionSerializer, OperationsReservationSerializer

ACTIVE_RESERVATIONS = (Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED, Reservation.Status.PAID)


def expeditions_with_occupancy():
    active = Q(reservations__status__in=ACTIVE_RESERVATIONS) | Q(reservations__status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), reservations__held_until__gt=timezone.now())
    return Expedition.objects.annotate(occupied_slots=Coalesce(Sum("reservations__participant_count", filter=active), Value(0), output_field=IntegerField()))


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not validate_credentials(str(request.data.get("email", "")), str(request.data.get("password", ""))):
            return Response({"detail": "E-mail ou senha inválidos."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"token": create_admin_token(), "email": request.data["email"]})


class ClearDevelopmentDataView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from django.conf import settings
        from django.db import transaction

        if not settings.DEBUG:
            return Response({"detail": "Ferramenta disponível apenas em desenvolvimento."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            transactions = PaymentTransaction.objects.count()
            payments = Payment.objects.count()
            reservations = Reservation.objects.count()
            customers = Customer.objects.count()
            PaymentTransaction.objects.all().delete()
            Payment.objects.all().delete()
            Reservation.objects.all().delete()
            VerificationChallenge.objects.all().delete()
            Customer.objects.all().delete()
        return Response({"cleared": {"transactions": transactions, "payments": payments, "reservations": reservations, "customers": customers}})


class OperationsView(APIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class OverviewView(OperationsView):
    def get(self, request):
        paid = Payment.objects.filter(status=Payment.Status.PAID).aggregate(total=Coalesce(Sum("amount_cents"), 0), count=Count("id"))
        reservations = Reservation.objects.aggregate(total=Count("id"), confirmed=Count("id", filter=Q(status__in=ACTIVE_RESERVATIONS)), awaiting=Count("id", filter=Q(status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT))))
        commercial = Reservation.objects.filter(status__in=ACTIVE_RESERVATIONS).aggregate(sold=Coalesce(Sum("total_price_cents"), 0))
        incomplete_participants = ReservationParticipant.objects.filter(reservation__status__in=ACTIVE_RESERVATIONS).exclude(onboarding_status=ReservationParticipant.OnboardingStatus.COMPLETED).count()
        upcoming = expeditions_with_occupancy().filter(ends_at__gte=timezone.localdate()).order_by("starts_at")[:4]
        recent = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants", "payments", "events").order_by("-created_at")[:5]
        return Response({"revenue_cents": paid["total"], "sold_cents": commercial["sold"], "outstanding_cents": max(commercial["sold"] - paid["total"], 0), "paid_payments": paid["count"], "incomplete_participants": incomplete_participants, "reservations": reservations, "upcoming_expeditions": OperationsExpeditionSerializer(upcoming, many=True).data, "recent_reservations": OperationsReservationSerializer(recent, many=True).data})


class ReservationListView(OperationsView):
    def get(self, request):
        queryset = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants", "payments", "events").order_by("-created_at")
        query = request.query_params.get("q", "").strip()
        state = request.query_params.get("status", "").strip()
        if query:
            digits = "".join(character for character in query if character.isdigit())
            search = Q(customer__full_name__icontains=query) | Q(customer__email__icontains=query) | Q(customer__phone__icontains=query)
            if digits:
                search |= Q(customer__cpf__icontains=digits)
            queryset = queryset.filter(search)
        if state:
            queryset = queryset.filter(status=state)
        return Response(OperationsReservationSerializer(queryset[:100], many=True).data)


class ExpeditionListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsExpeditionSerializer

    def get_queryset(self):
        return expeditions_with_occupancy().order_by("-starts_at")


class ExpeditionDetailView(generics.RetrieveUpdateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsExpeditionSerializer

    def get_queryset(self):
        return expeditions_with_occupancy()
