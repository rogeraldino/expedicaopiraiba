import csv
import io
import math
from django.db import transaction
from django.db.models import Count, F, IntegerField, Q, Sum, Value
from django.http import HttpResponse
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expeditions.models import ChecklistItem, Expedition, ExpeditionConfigurationEvent, ExpeditionProduct, Product
from apps.payments.models import Payment
from apps.payments.models import PaymentTransaction
from apps.customers.models import Customer, VerificationChallenge
from apps.reservations.models import DietaryRestriction, ParticipantProductChoice, Reservation, ReservationEvent, ReservationParticipant
from apps.reservations.services import record_reservation_event, transition_locked_reservation
from apps.payments.services import process_paid_event

from .authentication import OperationsAuthentication, create_admin_token, validate_credentials
from .serializers import OperationsExpeditionSerializer, OperationsReservationSerializer

ACTIVE_RESERVATIONS = (Reservation.Status.CONFIRMED, Reservation.Status.PAID)


def expeditions_with_occupancy():
    active = Q(reservations__status__in=ACTIVE_RESERVATIONS) | Q(reservations__status=Reservation.Status.PARTIALLY_PAID, reservations__payments__status=Payment.Status.PAID, reservations__payments__amount_cents__gte=F("reservations__deposit_cents")) | Q(reservations__status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), reservations__held_until__gt=timezone.now())
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
        recent = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions", "payments", "events", "expedition__checklist_items").order_by("-created_at")[:5]
        alerts = []
        active_reservations = Reservation.objects.filter(status__in=ACTIVE_RESERVATIONS).select_related("expedition").prefetch_related("participants__dietary_restrictions__restriction", "participants__checklist_completions", "expedition__checklist_items", "payments")
        for item in active_reservations:
            if item.remaining_balance_cents and item.balance_due_at and item.balance_due_at < timezone.localdate(): alerts.append({"id": f"balance-{item.id}", "type": "OVERDUE_BALANCE", "level": "warning", "title": "Saldo vencido", "message": "Reserva com saldo vencido.", "reservation_id": str(item.id), "expedition_id": str(item.expedition_id)})
            if item.participants.filter(dietary_restrictions__restriction__is_none=False).exists(): alerts.append({"id": f"diet-{item.id}", "type": "DIETARY", "level": "warning", "title": "Restrição alimentar", "message": "Reserva possui restrição alimentar.", "reservation_id": str(item.id), "expedition_id": str(item.expedition_id)})
        indicators = []
        for expedition in expeditions_with_occupancy().order_by("starts_at"):
            eligible = Reservation.objects.filter(expedition=expedition, status__in=ACTIVE_RESERVATIONS)
            sold = eligible.aggregate(value=Coalesce(Sum("total_price_cents"), 0))["value"]
            received = Payment.objects.filter(reservation__expedition=expedition, status=Payment.Status.PAID).aggregate(value=Coalesce(Sum("amount_cents"), 0))["value"]
            people = ReservationParticipant.objects.filter(reservation__in=eligible)
            indicators.append({"expedition_id": str(expedition.id), "expedition_name": expedition.name, "capacity": expedition.capacity, "occupied_slots": expedition.occupied_slots, "confirmed_slots": eligible.aggregate(value=Coalesce(Sum("participant_count"), 0))["value"], "held_slots": Reservation.objects.filter(expedition=expedition, status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__gt=timezone.now()).aggregate(value=Coalesce(Sum("participant_count"), 0))["value"], "available_slots": max(expedition.capacity-expedition.occupied_slots, 0), "sold_cents": sold, "received_cents": received, "outstanding_cents": max(sold-received, 0), "pending_preferences": people.filter(Q(product_choices_confirmed_at__isnull=True)|Q(dietary_confirmed_at__isnull=True)).distinct().count(), "pending_checklists": sum(1 for p in people.prefetch_related("checklist_completions", "reservation__expedition__checklist_items") if not set(expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True)).issubset(set(p.checklist_completions.filter(completed=True).values_list("item_id", flat=True)))), "restrictions": people.filter(dietary_restrictions__restriction__is_none=False).distinct().count()})
        return Response({"revenue_cents": paid["total"], "sold_cents": commercial["sold"], "outstanding_cents": max(commercial["sold"] - paid["total"], 0), "paid_payments": paid["count"], "incomplete_participants": incomplete_participants, "reservations": reservations, "alerts": alerts, "expedition_indicators": indicators, "upcoming_expeditions": OperationsExpeditionSerializer(upcoming, many=True).data, "recent_reservations": OperationsReservationSerializer(recent, many=True).data})


class ReservationListView(OperationsView):
    def get(self, request):
        queryset = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions", "payments", "events", "expedition__checklist_items").order_by("-created_at")
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
        expedition = request.query_params.get("expedition", "").strip()
        if expedition:
            queryset = queryset.filter(expedition_id=expedition)
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


class ReservationDetailView(OperationsView):
    def get(self, request, reservation_id):
        try:
            item = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions__item", "payments", "events").get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=404)
        return Response(OperationsReservationSerializer(item).data)


class ManualPaymentView(OperationsView):
    @transaction.atomic
    def post(self, request, reservation_id):
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=404)
        amount = int(request.data.get("amount_cents", 0))
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            return Response({"detail": "Motivo é obrigatório para auditoria."}, status=400)
        if amount <= 0 or amount > reservation.remaining_balance_cents:
            return Response({"detail": "Valor inválido ou superior ao saldo."}, status=400)
        if reservation.status not in (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT, Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED):
            return Response({"detail": "Estado da reserva não aceita pagamento manual."}, status=409)
        if reservation.status == Reservation.Status.HELD:
            transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.AWAITING_PAYMENT, event_type="MANUAL_PAYMENT_STARTED", actor_type=ReservationEvent.ActorType.ADMIN, actor_identifier="operations", reason=reason)
        payment = Payment.objects.create(reservation=reservation, purpose=Payment.Purpose.MANUAL, provider="ADMIN", method=str(request.data.get("method", "MANUAL"))[:20], external_id=f"manual-{reservation.id}-{timezone.now().timestamp()}", amount_cents=amount)
        payment, processed = process_paid_event(external_event_id=f"manual-event-{payment.id}", external_payment_id=payment.external_id, payload={"source": "operations", "reason": reason})
        record_reservation_event(reservation=reservation, event_type="MANUAL_PAYMENT_RECORDED", actor_type=ReservationEvent.ActorType.ADMIN, actor_identifier="operations", reason=reason, payload={"payment_id": str(payment.id), "amount_cents": amount, "processed": processed})
        return Response({"payment_id": payment.id, "status": payment.status}, status=201)


class CancelReservationView(OperationsView):
    @transaction.atomic
    def post(self, request, reservation_id):
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            return Response({"detail": "Motivo é obrigatório."}, status=400)
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id)
            transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.CANCELLED, event_type="RESERVATION_CANCELLED", actor_type=ReservationEvent.ActorType.ADMIN, actor_identifier="operations", reason=reason)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=404)
        except Exception as error:
            return Response({"detail": str(error)}, status=400)
        return Response({"id": reservation.id, "status": reservation.status})


def configuration_payload(expedition):
    return {"meeting_instructions": expedition.meeting_instructions, "departure_location": expedition.departure_location,
        "products": [{"id": p.id, "name": p.name, "unit": p.unit, "package_size": p.package_size, "aliases": p.aliases, "active": p.active} for p in Product.objects.order_by("name")],
        "offers": [{"id": o.id, "product_id": o.product_id, "name": o.product.name, "standard_quantity_per_participant": o.standard_quantity_per_participant, "display_order": o.display_order, "note": o.note, "active": o.active, "updated_at": o.updated_at} for o in expedition.product_offers.select_related("product")],
        "checklist_items": [{"id": i.id, "title": i.title, "description": i.description, "display_order": i.display_order, "required": i.required, "active": i.active} for i in expedition.checklist_items.all()],
        "dietary_restrictions": list(DietaryRestriction.objects.filter(active=True).values("code", "name", "requires_details", "is_none"))}


class ExpeditionConfigurationView(OperationsView):
    def get(self, request, expedition_id):
        try: expedition = Expedition.objects.get(id=expedition_id)
        except Expedition.DoesNotExist: return Response({"detail": "Expedição não encontrada."}, status=404)
        return Response(configuration_payload(expedition))

    @transaction.atomic
    def put(self, request, expedition_id):
        try: expedition = Expedition.objects.select_for_update().get(id=expedition_id)
        except Expedition.DoesNotExist: return Response({"detail": "Expedição não encontrada."}, status=404)
        if expedition.status in (Expedition.Status.IN_PROGRESS, Expedition.Status.COMPLETED):
            return Response({"detail": "Configuração bloqueada após o início da expedição."}, status=409)
        products_input = request.data.get("products", [])
        offers_input = request.data.get("offers", [])
        checklist_input = request.data.get("checklist_items", request.data.get("checklist", []))
        if not all(isinstance(value, list) for value in (products_input, offers_input, checklist_input)):
            return Response({"detail": "Produtos, ofertas e checklist devem ser listas."}, status=400)
        product_ids = {str(x) for x in Product.objects.values_list("id", flat=True)}
        checklist_ids = {str(x) for x in expedition.checklist_items.values_list("id", flat=True)}
        valid_units = {choice for choice, _ in Product.Unit.choices}
        try:
            for raw in products_input:
                if not isinstance(raw, dict) or (raw.get("id") and str(raw["id"]) not in product_ids): raise ValueError("Produto inválido.")
                if not raw.get("id") and not str(raw.get("name", "")).strip(): raise ValueError("Nome do produto é obrigatório.")
                if "unit" in raw and raw["unit"] not in valid_units: raise ValueError("Unidade operacional inválida.")
                if raw.get("package_size") is not None and int(raw["package_size"]) <= 0: raise ValueError("Tamanho de embalagem deve ser positivo.")
            for raw in offers_input:
                if not isinstance(raw, dict) or str(raw.get("product_id", "")) not in product_ids: raise ValueError("Produto da oferta não existe.")
                if int(raw.get("standard_quantity_per_participant", 1)) <= 0: raise ValueError("Quantidade padrão deve ser positiva.")
                int(raw.get("display_order", 0))
            for raw in checklist_input:
                if not isinstance(raw, dict) or (raw.get("id") and str(raw["id"]) not in checklist_ids): raise ValueError("Item de checklist inválido.")
                if not raw.get("id") and not str(raw.get("title", "")).strip(): raise ValueError("Título do checklist é obrigatório.")
                int(raw.get("display_order", 0))
        except (TypeError, ValueError) as error:
            return Response({"detail": str(error)}, status=400)
        expedition.departure_location = request.data.get("departure_location", expedition.departure_location)
        expedition.meeting_instructions = request.data.get("meeting_instructions", expedition.meeting_instructions)
        expedition.save(update_fields=("departure_location", "meeting_instructions", "updated_at"))
        for raw in products_input:
            if raw.get("id"):
                product = Product.objects.get(id=raw["id"])
                for field in ("name", "category", "unit", "package_size", "aliases", "active"):
                    if field in raw: setattr(product, field, raw[field])
                product.save()
            else:
                Product.objects.create(**{k: raw[k] for k in ("name", "category", "unit", "package_size", "aliases", "active") if k in raw})
        for raw in offers_input:
            product = Product.objects.get(id=raw["product_id"])
            quantity = int(raw.get("standard_quantity_per_participant", 1))
            offer, created = ExpeditionProduct.objects.get_or_create(expedition=expedition, product=product, defaults={"standard_quantity_per_participant": quantity})
            previous = offer.standard_quantity_per_participant
            for field in ("standard_quantity_per_participant", "display_order", "note", "active"):
                if field in raw: setattr(offer, field, raw[field])
            offer.save()
            if previous != offer.standard_quantity_per_participant:
                ExpeditionConfigurationEvent.objects.create(expedition=expedition, event_type="OFFER_QUANTITY_UPDATED", actor_identifier="operations", payload={"offer_id": str(offer.id), "previous": previous, "new": offer.standard_quantity_per_participant})
        for raw in checklist_input:
            if raw.get("id"):
                item = ChecklistItem.objects.get(id=raw["id"], expedition=expedition)
                for field in ("title", "description", "display_order", "required", "active"):
                    if field in raw: setattr(item, field, raw[field])
                item.save()
            else:
                ChecklistItem.objects.create(expedition=expedition, **{k: raw[k] for k in ("title", "description", "display_order", "required", "active") if k in raw})
        ExpeditionConfigurationEvent.objects.create(expedition=expedition, event_type="CONFIGURATION_UPDATED", actor_identifier="operations", payload={"offers_received": len(offers_input), "checklist_items_received": len(checklist_input)})
        return Response(configuration_payload(expedition))


def consolidation_rows(expedition):
    valid = (Reservation.Status.CONFIRMED, Reservation.Status.PAID)
    choices = list(ParticipantProductChoice.objects.select_for_update().filter(expedition_product__expedition=expedition, selected=True, participant__reservation__status__in=valid).select_related("participant__reservation__customer").order_by("participant__reservation_id", "participant__full_name"))
    by_offer = {}
    for choice in choices:
        by_offer.setdefault(choice.expedition_product_id, []).append({"reservation_id": str(choice.participant.reservation_id), "customer_name": choice.participant.reservation.customer.full_name, "participant_id": str(choice.participant_id), "participant_name": choice.participant.full_name})
    rows = []
    for offer in expedition.product_offers.select_for_update().filter(active=True, product__active=True).select_related("product").order_by("display_order", "product__name"):
        details = by_offer.get(offer.id, [])
        people = len(details)
        total = people * offer.standard_quantity_per_participant
        size = offer.product.package_size
        rows.append({"offer_id": str(offer.id), "product": offer.product.name, "unit": offer.product.unit, "people": people, "standard_quantity_per_participant": offer.standard_quantity_per_participant, "total": total, "package_size": size, "full_packages": total // size if size else None, "remainder": total % size if size else None, "details": details, "updated_at": offer.updated_at})
    return rows


class ConsolidationView(OperationsView):
    format = "json"
    @transaction.atomic
    def get(self, request, expedition_id):
        try: expedition = Expedition.objects.select_for_update().get(id=expedition_id)
        except Expedition.DoesNotExist: return Response({"detail": "Expedição não encontrada."}, status=404)
        rows = consolidation_rows(expedition)
        if self.format == "json": return Response({"expedition_id": expedition.id, "items": rows, "generated_at": timezone.now()})
        def safe(value):
            text = str(value)
            return "'" + text if text.startswith(("=", "+", "-", "@")) else text
        if self.format == "txt":
            body = "\n".join(f"{safe(r['product'])}: {r['total']} {r['unit']} ({r['people']} pessoas)" for r in rows)
            return HttpResponse(body, content_type="text/plain; charset=utf-8")
        output = io.StringIO(); writer = csv.writer(output); writer.writerow(("produto", "unidade", "pessoas", "padrao", "total", "embalagens", "sobra"))
        for r in rows: writer.writerow((safe(r["product"]), r["unit"], r["people"], r["standard_quantity_per_participant"], r["total"], r["full_packages"], r["remainder"]))
        return HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")


class ConsolidationCsvView(ConsolidationView): format = "csv"
class ConsolidationTxtView(ConsolidationView): format = "txt"
