from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.services import customer_from_session_token

from .customer_serializers import CustomerParticipantSerializer
from .models import Reservation, ReservationParticipant


def authenticated_customer(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return customer_from_session_token(header[7:])
    except DjangoValidationError:
        return None


def reservation_payload(reservation):
    participants = list(reservation.participants.all())
    participant_step = bool(participants) and all(item.onboarding_status == ReservationParticipant.OnboardingStatus.COMPLETED for item in participants)
    payment_step = reservation.status in (Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.PARTIALLY_PAID)
    prefs = reservation.beverage_preferences or {}
    preferences_step = bool(prefs.get("completed")) or bool(prefs.get("beverages"))
    dietary_step = bool(prefs.get("dietary_restrictions")) or bool(prefs.get("completed"))
    checklist_step = bool(prefs.get("checklist_reviewed"))
    steps = {
        "payment": payment_step,
        "participants": participant_step,
        "preferences": preferences_step,
        "dietary_restrictions": dietary_step,
        "checklist": checklist_step,
    }
    return {
        "id": str(reservation.id),
        "reference": f"EXP-{str(reservation.id).split('-')[0].upper()}",
        "status": reservation.status,
        "participant_count": reservation.participant_count,
        "payment_plan": reservation.payment_plan,
        "total_price_cents": reservation.total_price_cents,
        "paid_amount_cents": reservation.paid_amount_cents,
        "remaining_balance_cents": reservation.remaining_balance_cents,
        "balance_due_at": reservation.balance_due_at,
        "preferences": prefs,
        "onboarding": {"completed": sum(steps.values()), "total": len(steps), "steps": steps},
        "participants": CustomerParticipantSerializer(participants, many=True).data,
        "expedition": {
            "name": reservation.expedition.name,
            "slug": reservation.expedition.slug,
            "destination": reservation.expedition.destination,
            "starts_at": reservation.expedition.starts_at,
            "ends_at": reservation.expedition.ends_at,
            "duration_days": reservation.expedition.duration_days,
            "price_per_person_cents": reservation.unit_price_cents,
        },
    }


class CustomerReservationDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, reservation_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            reservation = Reservation.objects.select_related("expedition").prefetch_related("participants", "payments").get(id=reservation_id, customer=customer)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(reservation_payload(reservation))


class CustomerParticipantDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def patch(self, request, reservation_id, participant_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            participant = ReservationParticipant.objects.select_related("reservation").get(id=participant_id, reservation_id=reservation_id, reservation__customer=customer)
        except ReservationParticipant.DoesNotExist:
            return Response({"detail": "Participante não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerParticipantSerializer(participant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        reservation = Reservation.objects.select_related("expedition").prefetch_related("participants", "payments").get(id=reservation_id)
        return Response(reservation_payload(reservation))


class CustomerReservationPreferencesView(APIView):
    authentication_classes = []
    permission_classes = []

    def patch(self, request, reservation_id):
        from django.utils import timezone
        from .models import ReservationEvent
        from .services import record_reservation_event

        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            reservation = Reservation.objects.select_related("expedition").prefetch_related("participants", "payments").get(id=reservation_id, customer=customer)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        current = reservation.beverage_preferences or {}
        current.update({
            "beverages": request.data.get("beverages", current.get("beverages", {})),
            "dietary_restrictions": request.data.get("dietary_restrictions", current.get("dietary_restrictions", "")),
            "notes": request.data.get("notes", current.get("notes", "")),
            "completed": True,
            "updated_at": timezone.now().isoformat(),
        })
        reservation.beverage_preferences = current
        reservation.save(update_fields=["beverage_preferences", "updated_at"])
        record_reservation_event(
            reservation=reservation,
            event_type="PREFERENCES_UPDATED",
            actor_type=ReservationEvent.ActorType.CUSTOMER,
            actor_identifier=str(customer.id),
            payload={"preferences": current},
        )
        return Response(reservation_payload(reservation))

