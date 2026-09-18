from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.services import customer_from_session_token

from .customer_serializers import CustomerParticipantSerializer
from django.db import transaction
from django.utils import timezone
from apps.expeditions.models import ChecklistItem, ExpeditionProduct
from .models import (DietaryRestriction, ParticipantChecklistCompletion,
    ParticipantDietaryRestriction, ParticipantProductChoice, Reservation,
    ReservationEvent, ReservationParticipant)
from .services import record_reservation_event


def authenticated_customer(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return customer_from_session_token(header[7:])
    except DjangoValidationError:
        return None


def derive_reservation_notices(reservation, steps):
    notices = []
    if reservation.remaining_balance_cents > 0:
        if reservation.balance_due_at and reservation.balance_due_at < timezone.localdate():
            notices.append("O saldo da reserva está vencido. O pagamento simulado continua disponível.")
        else:
            notices.append("Há saldo pendente nesta reserva.")
    if sum(steps.values()) < len(steps):
        notices.append("Ainda há etapas de preparação pendentes.")
    days_to_start = (reservation.expedition.starts_at - timezone.localdate()).days
    if 0 <= days_to_start <= 7:
        notices.append("A expedição está próxima. Revise encontro, documentos e checklist.")
    return notices


def reservation_payload(reservation):
    participants = list(reservation.participants.all())
    participant_step = bool(participants) and all(item.onboarding_status == ReservationParticipant.OnboardingStatus.COMPLETED for item in participants)
    payment_step = reservation.status in (Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.PARTIALLY_PAID)
    prefs = reservation.beverage_preferences or {}
    preferences_step = bool(participants) and all(p.product_choices_confirmed_at for p in participants)
    dietary_step = bool(participants) and all(p.dietary_confirmed_at for p in participants)
    required_ids = set(reservation.expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True))
    active_checklist_exists = reservation.expedition.checklist_items.filter(active=True).exists()
    checklist_step = active_checklist_exists and bool(participants) and all(required_ids.issubset(set(p.checklist_completions.filter(completed=True).values_list("item_id", flat=True))) for p in participants)
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
        "reservation_status": reservation.status,
        "participant_count": reservation.participant_count,
        "payment_plan": reservation.payment_plan,
        "total_price_cents": reservation.total_price_cents,
        "paid_amount_cents": reservation.paid_amount_cents,
        "remaining_balance_cents": reservation.remaining_balance_cents,
        "balance_due_at": reservation.balance_due_at,
        "notices": derive_reservation_notices(reservation, steps),
        "whatsapp_url": getattr(settings, "OPERATIONAL_WHATSAPP_URL", "https://wa.me/5562981612128"),
        "preferences": prefs,
        "onboarding": {"completed": sum(steps.values()), "total": len(steps), "steps": steps},
        "participants": [participant_payload(p, required_ids) for p in participants],
        "expedition": {
            "name": reservation.expedition.name,
            "slug": reservation.expedition.slug,
            "destination": reservation.expedition.destination,
            "starts_at": reservation.expedition.starts_at,
            "ends_at": reservation.expedition.ends_at,
            "duration_days": reservation.expedition.duration_days,
            "price_per_person_cents": reservation.unit_price_cents,
            "departure_location": reservation.expedition.departure_location,
            "meeting_instructions": reservation.expedition.meeting_instructions,
            "offers": [{"id": str(o.id), "product_id": o.product_id, "name": o.product.name, "unit": o.product.unit, "note": o.note} for o in reservation.expedition.product_offers.filter(active=True, product__active=True).select_related("product")],
            "checklist_items": [{"id": str(i.id), "title": i.title, "description": i.description, "required": i.required} for i in reservation.expedition.checklist_items.filter(active=True)],
        },
        "events": [{"type": e.event_type, "created_at": e.created_at} for e in reservation.events.filter(event_type__in=("RESERVATION_HELD", "PAYMENT_CONFIRMED", "PREFERENCES_UPDATED", "CHECKLIST_UPDATED", "RESERVATION_CANCELLED")).order_by("-created_at")[:20]],
    }


def participant_payload(participant, required_ids=None):
    data = CustomerParticipantSerializer(participant).data
    selected = list(participant.product_choices.filter(selected=True).values_list("expedition_product_id", flat=True))
    restrictions = list(participant.dietary_restrictions.values_list("restriction__code", flat=True))
    completed = list(participant.checklist_completions.filter(completed=True).values_list("item_id", flat=True))
    required_ids = required_ids or set()
    data.update({"selected_offer_ids": [str(x) for x in selected], "no_beverages": bool(participant.product_choices_confirmed_at and not selected), "preferences_confirmed": bool(participant.product_choices_confirmed_at), "dietary_restriction_codes": restrictions, "dietary_details": participant.dietary_details, "dietary_confirmed": bool(participant.dietary_confirmed_at), "completed_item_ids": [str(x) for x in completed], "checklist_complete": required_ids.issubset(set(completed))})
    return data


class CustomerReservationDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, reservation_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            reservation = Reservation.objects.select_related("expedition").prefetch_related("participants__product_choices", "participants__dietary_restrictions__restriction", "participants__checklist_completions", "payments", "events", "expedition__checklist_items").get(id=reservation_id, customer=customer)
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
        if participant.reservation.expedition.status in (participant.reservation.expedition.Status.IN_PROGRESS, participant.reservation.expedition.Status.COMPLETED):
            return Response({"detail": "Cadastro bloqueado após o início da expedição."}, status=409)
        serializer = CustomerParticipantSerializer(participant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        reservation = Reservation.objects.select_related("expedition").prefetch_related("participants", "payments").get(id=reservation_id)
        return Response(reservation_payload(reservation))


class CustomerReservationPreferencesView(APIView):
    authentication_classes = []
    permission_classes = []

    def patch(self, request, reservation_id):
        return Response({"detail": "Use preferências individuais por participante."}, status=410)


class CustomerParticipantPreferencesView(APIView):
    authentication_classes = []
    permission_classes = []

    @transaction.atomic
    def put(self, request, reservation_id, participant_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            participant = ReservationParticipant.objects.select_for_update().select_related("reservation__expedition").get(id=participant_id, reservation_id=reservation_id, reservation__customer=customer)
        except ReservationParticipant.DoesNotExist:
            return Response({"detail": "Participante não encontrado."}, status=404)
        if participant.reservation.expedition.status in (participant.reservation.expedition.Status.IN_PROGRESS, participant.reservation.expedition.Status.COMPLETED):
            return Response({"detail": "Preferências bloqueadas após o início da expedição."}, status=409)
        selected_ids = set(str(x) for x in request.data.get("selected_offer_ids", []))
        no_beverages = request.data.get("no_beverages", False)
        if selected_ids and no_beverages:
            return Response({"detail": "Escolha bebidas ou confirme nenhuma bebida."}, status=400)
        offers = list(ExpeditionProduct.objects.filter(id__in=selected_ids, expedition=participant.reservation.expedition, active=True, product__active=True))
        if len(offers) != len(selected_ids):
            return Response({"detail": "Oferta inválida ou inativa."}, status=400)
        codes = list(dict.fromkeys(request.data.get("dietary_restriction_codes", [])))
        restrictions = list(DietaryRestriction.objects.filter(code__in=codes, active=True))
        if len(restrictions) != len(codes):
            return Response({"detail": "Restrição alimentar inválida."}, status=400)
        none = [r for r in restrictions if r.is_none]
        details = str(request.data.get("dietary_details", "")).strip()
        if none and len(restrictions) > 1:
            return Response({"detail": "Sem restrições é mutuamente exclusivo."}, status=400)
        if any(r.requires_details for r in restrictions) and not details:
            return Response({"detail": "Detalhes são obrigatórios para a restrição informada."}, status=400)
        current_selected = set(str(x) for x in participant.product_choices.filter(selected=True).values_list("expedition_product_id", flat=True))
        current_codes = set(participant.dietary_restrictions.values_list("restriction__code", flat=True))
        beverage_confirmed = bool(selected_ids or no_beverages)
        dietary_confirmed = bool(restrictions)
        if current_selected == selected_ids and current_codes == set(codes) and participant.dietary_details == details and bool(participant.product_choices_confirmed_at) == beverage_confirmed and bool(participant.dietary_confirmed_at) == dietary_confirmed:
            return Response(participant_payload(participant))
        ParticipantProductChoice.objects.filter(participant=participant).exclude(expedition_product_id__in=[o.id for o in offers]).update(selected=False)
        for offer in offers:
            ParticipantProductChoice.objects.update_or_create(participant=participant, expedition_product=offer, defaults={"selected": True})
        participant.product_choices_confirmed_at = timezone.now() if beverage_confirmed else None
        ParticipantDietaryRestriction.objects.filter(participant=participant).delete()
        ParticipantDietaryRestriction.objects.bulk_create([ParticipantDietaryRestriction(participant=participant, restriction=r) for r in restrictions])
        participant.dietary_details = details
        participant.dietary_confirmed_at = timezone.now() if dietary_confirmed else None
        participant.save(update_fields=("product_choices_confirmed_at", "dietary_confirmed_at", "dietary_details", "updated_at"))
        record_reservation_event(reservation=participant.reservation, event_type="PREFERENCES_UPDATED", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id), payload={"participant_id": str(participant.id), "selected_count": len(offers), "restriction_count": len(restrictions)})
        reservation = Reservation.objects.select_related("expedition").prefetch_related(
            "participants__product_choices",
            "participants__dietary_restrictions__restriction",
            "participants__checklist_completions",
            "payments",
            "events",
            "expedition__checklist_items",
        ).get(id=reservation_id)
        return Response(reservation_payload(reservation))


class CustomerParticipantChecklistView(APIView):
    authentication_classes = []
    permission_classes = []

    @transaction.atomic
    def put(self, request, reservation_id, participant_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            participant = ReservationParticipant.objects.select_for_update().select_related("reservation__expedition").get(id=participant_id, reservation_id=reservation_id, reservation__customer=customer)
        except ReservationParticipant.DoesNotExist:
            return Response({"detail": "Participante não encontrado."}, status=404)
        if participant.reservation.expedition.status in (participant.reservation.expedition.Status.IN_PROGRESS, participant.reservation.expedition.Status.COMPLETED):
            return Response({"detail": "Checklist bloqueado após o início da expedição."}, status=409)
        ids = set(str(x) for x in request.data.get("completed_item_ids", []))
        items = list(ChecklistItem.objects.filter(id__in=ids, expedition=participant.reservation.expedition, active=True))
        if len(items) != len(ids):
            return Response({"detail": "Item de checklist inválido ou inativo."}, status=400)
        current_ids = set(str(x) for x in participant.checklist_completions.filter(completed=True).values_list("item_id", flat=True))
        if current_ids == ids:
            required = set(ChecklistItem.objects.filter(expedition=participant.reservation.expedition, active=True, required=True).values_list("id", flat=True))
            return Response(participant_payload(participant, required))
        ParticipantChecklistCompletion.objects.filter(participant=participant).exclude(item_id__in=[x.id for x in items]).update(completed=False, completed_at=None)
        for item in items:
            ParticipantChecklistCompletion.objects.update_or_create(participant=participant, item=item, defaults={"completed": True, "completed_at": timezone.now()})
        record_reservation_event(reservation=participant.reservation, event_type="CHECKLIST_UPDATED", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id), payload={"participant_id": str(participant.id), "completed_count": len(items)})
        required = set(ChecklistItem.objects.filter(expedition=participant.reservation.expedition, active=True, required=True).values_list("id", flat=True))
        reservation = Reservation.objects.select_related("expedition").prefetch_related(
            "participants__product_choices",
            "participants__dietary_restrictions__restriction",
            "participants__checklist_completions",
            "payments",
            "events",
            "expedition__checklist_items",
        ).get(id=reservation_id)
        payload = reservation_payload(reservation)
        payload["checklist_complete"] = required.issubset(
            set(participant.checklist_completions.filter(completed=True).values_list("item_id", flat=True))
        )
        return Response(payload)
