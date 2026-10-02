import csv
import io
import math
from datetime import timedelta
from django.db import models, transaction
from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, Sum, Value, When
from django.http import HttpResponse
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expeditions.models import (
    AllInclusivePackage,
    Amenity,
    BeveragePackage,
    BeveragePackageItem,
    ChecklistItem,
    Expedition,
    ExpeditionConfigurationEvent,
    ExpeditionProduct,
    FishingGearProduct,
    GearCategory,
    Lodge,
    Product,
    River,
    RiverSpecies,
    TargetSpecies,
)
from apps.payments.models import Payment
from apps.payments.models import PaymentTransaction
from apps.customers.models import Customer, CustomerProfile, VerificationChallenge
from apps.reservations.models import DietaryRestriction, ParticipantProductChoice, Reservation, ReservationEvent, ReservationGearAddon, ReservationParticipant
from apps.reservations.services import recalculate_reservation_financials, record_reservation_event, transition_locked_reservation
from apps.payments.services import process_paid_event

from .authentication import OperationsAuthentication, create_admin_token, validate_credentials
from .serializers import (
    AdminCustomerDetailSerializer,
    AdminCustomerListSerializer,
    AllInclusivePackageSerializer,
    AmenitySerializer,
    BeveragePackageItemSerializer,
    BeveragePackageSerializer,
    CustomerProfileSerializer,
    FishingGearProductSerializer,
    ManualReservationSerializer,
    OperationsExpeditionSerializer,
    OperationsLodgeSerializer,
    OperationsReservationSerializer,
    OperationsSpeciesSerializer,
    ParticipantUpdateSerializer,
    ReservationGearAddonSerializer,
    RiverSerializer,
    RiverSpeciesSerializer,
)

ACTIVE_RESERVATIONS = (Reservation.Status.CONFIRMED, Reservation.Status.PAID)


def expeditions_with_occupancy():
    active = Q(reservations__status__in=ACTIVE_RESERVATIONS) | Q(reservations__status=Reservation.Status.PARTIALLY_PAID, reservations__payments__status=Payment.Status.PAID, reservations__payments__amount_cents__gte=F("reservations__deposit_cents")) | Q(reservations__status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), reservations__held_until__gt=timezone.now())
    return Expedition.objects.annotate(occupied_slots=Coalesce(Sum("reservations__participant_count", filter=active), Value(0), output_field=IntegerField())).select_related("lodge").prefetch_related("expedition_species__species")


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
        recent = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions", "gear_addons__gear_product", "gear_addons__participant", "payments", "events", "expedition__checklist_items").order_by("-created_at")[:5]
        alerts = []
        active_reservations = Reservation.objects.filter(status__in=ACTIVE_RESERVATIONS).select_related("expedition").prefetch_related("participants__dietary_restrictions__restriction", "participants__checklist_completions", "gear_addons__gear_product", "expedition__checklist_items", "payments")
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
        queryset = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions", "gear_addons__gear_product", "gear_addons__participant", "payments", "events", "expedition__checklist_items").order_by("-created_at")
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

    @transaction.atomic
    def post(self, request):
        serializer = ManualReservationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            expedition = Expedition.objects.select_for_update().get(id=data["expedition_id"])
        except Expedition.DoesNotExist:
            return Response({"detail": "Expedição não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        spots = data["spots_count"]
        active_q = (
            Q(reservations__status__in=ACTIVE_RESERVATIONS)
            | Q(reservations__status=Reservation.Status.PARTIALLY_PAID, reservations__payments__status=Payment.Status.PAID, reservations__payments__amount_cents__gte=F("reservations__deposit_cents"))
            | Q(reservations__status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), reservations__held_until__gt=timezone.now())
        )
        exp_with_occ = Expedition.objects.filter(id=expedition.id).annotate(
            occupied_slots=Coalesce(Sum("reservations__participant_count", filter=active_q), Value(0), output_field=IntegerField())
        ).first()
        available = exp_with_occ.capacity - exp_with_occ.occupied_slots
        if spots > available:
            return Response({"detail": f"Capacidade insuficiente. Apenas {available} vaga(s) disponível(is)."}, status=status.HTTP_409_CONFLICT)

        clean_cpf = data["customer_cpf"]
        customer, _ = Customer.objects.get_or_create(
            cpf=clean_cpf,
            defaults={
                "full_name": data["customer_name"],
                "email": data["customer_email"],
                "phone": data["customer_phone"],
            },
        )
        customer.full_name = data["customer_name"]
        customer.email = data["customer_email"]
        customer.phone = data["customer_phone"]
        customer.save()

        unit_price = expedition.price_per_person_cents
        total_price = unit_price * spots
        # Sinal é de 20% à vista
        deposit = round(total_price * 0.20)
        balance_days = getattr(expedition, "balance_due_days_before", 30)
        balance_due_at = expedition.starts_at - timedelta(days=balance_days)

        status_choice = data["status"]
        if status_choice == "HELD":
            hold_hours = data.get("hold_hours", 24)
            held_until = timezone.now() + timedelta(hours=hold_hours)
            res_status = Reservation.Status.HELD
            payment_plan = Reservation.PaymentPlan.DEPOSIT
        else:
            held_until = None
            payment_type = data.get("payment_type", "DEPOSIT")
            if payment_type == "FULL":
                res_status = Reservation.Status.PAID
                payment_plan = Reservation.PaymentPlan.FULL
            else:
                res_status = Reservation.Status.CONFIRMED
                payment_plan = Reservation.PaymentPlan.DEPOSIT

        reservation = Reservation.objects.create(
            customer=customer,
            expedition=expedition,
            participant_count=spots,
            status=res_status,
            held_until=held_until,
            unit_price_cents=unit_price,
            total_price_cents=total_price,
            deposit_cents=deposit,
            payment_plan=payment_plan,
            balance_due_at=balance_due_at,
        )

        provided_names = data.get("participant_names", [])
        for i in range(spots):
            if i < len(provided_names) and provided_names[i].strip():
                p_name = provided_names[i].strip()
            elif i == 0:
                p_name = customer.full_name
            else:
                p_name = f"Participante {i + 1}"

            ReservationParticipant.objects.create(
                reservation=reservation,
                full_name=p_name,
                cpf=clean_cpf if i == 0 else "",
                phone=customer.phone if i == 0 else "",
                onboarding_status=ReservationParticipant.OnboardingStatus.PENDING,
            )

        reason = data["reason"]
        if status_choice == "CONFIRMED":
            payment_type = data.get("payment_type", "DEPOSIT")
            amount = data.get("payment_amount_cents")
            if not amount:
                amount = total_price if payment_type == "FULL" else deposit

            payment = Payment.objects.create(
                reservation=reservation,
                purpose=Payment.Purpose.MANUAL,
                provider="ADMIN",
                method="MANUAL",
                external_id=f"manual-{reservation.id}-{int(timezone.now().timestamp())}",
                amount_cents=amount,
                status=Payment.Status.PAID,
                paid_at=timezone.now(),
            )
            record_reservation_event(
                reservation=reservation,
                event_type="PAYMENT_CONFIRMED",
                actor_type=ReservationEvent.ActorType.ADMIN,
                actor_identifier="operations",
                reason=reason,
                payload={"payment_id": str(payment.id), "amount_cents": amount, "method": "MANUAL"},
            )

        record_reservation_event(
            reservation=reservation,
            event_type="MANUAL_RESERVATION_CREATED",
            actor_type=ReservationEvent.ActorType.ADMIN,
            actor_identifier="operations",
            reason=reason,
            payload={
                "spots_count": spots,
                "status": res_status,
                "payment_type": data.get("payment_type", "NONE"),
                "deposit_cents": deposit,
                "total_price_cents": total_price,
            },
        )

        refreshed = Reservation.objects.select_related("customer", "expedition").prefetch_related(
            "participants__product_choices__expedition_product__product",
            "participants__dietary_restrictions__restriction",
            "participants__checklist_completions",
            "payments",
            "events",
            "expedition__checklist_items",
        ).get(id=reservation.id)
        return Response(OperationsReservationSerializer(refreshed).data, status=status.HTTP_201_CREATED)


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


class LodgeListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsLodgeSerializer

    def get_queryset(self):
        return Lodge.objects.all().select_related("river").prefetch_related("amenities_structured", "target_species").order_by("name")


class LodgeDetailView(generics.RetrieveUpdateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsLodgeSerializer
    queryset = Lodge.objects.all().select_related("river").prefetch_related("amenities_structured", "target_species")


class RiverListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RiverSerializer

    def get_queryset(self):
        qs = River.objects.all().prefetch_related("river_species__species", "lodges")
        basin = self.request.query_params.get("basin")
        if basin:
            qs = qs.filter(basin=basin)
        state = self.request.query_params.get("state")
        if state:
            qs = qs.filter(states__contains=[state])
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() in ("true", "1"))
        return qs.order_by("name")


class RiverDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RiverSerializer
    queryset = River.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.lodges.exists():
            return Response(
                {"detail": "Não é possível excluir rio com pousadas associadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class RiverSpeciesView(APIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, river_id):
        try:
            river = River.objects.get(id=river_id)
        except River.DoesNotExist:
            return Response({"detail": "Rio não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        links = river.river_species.select_related("species").order_by("species__category", "species__common_name")
        return Response(RiverSpeciesSerializer(links, many=True).data)

    def post(self, request, river_id):
        try:
            river = River.objects.get(id=river_id)
        except River.DoesNotExist:
            return Response({"detail": "Rio não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        species_slug = request.data.get("species_slug") or request.data.get("species")
        if not species_slug:
            return Response({"detail": "Identificador da espécie (slug) é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_species = TargetSpecies.objects.get(slug=species_slug)
        except TargetSpecies.DoesNotExist:
            return Response({"detail": "Espécie não encontrada."}, status=status.HTTP_400_BAD_REQUEST)

        is_trophy = bool(request.data.get("is_trophy", False))
        is_native = bool(request.data.get("is_native", True))
        best_season = str(request.data.get("best_season", "") or "")

        link, created = RiverSpecies.objects.update_or_create(
            river=river,
            species=target_species,
            defaults={
                "is_trophy": is_trophy,
                "is_native": is_native,
                "best_season": best_season,
            },
        )
        return Response(RiverSpeciesSerializer(link).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, river_id):
        species_slug = request.data.get("species_slug") or request.query_params.get("species_slug")
        if not species_slug:
            return Response({"detail": "species_slug é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = RiverSpecies.objects.filter(river_id=river_id, species__slug=species_slug).delete()
        if not deleted:
            return Response({"detail": "Associação de espécie não encontrada no rio."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AmenityListView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AmenitySerializer

    def get_queryset(self):
        qs = Amenity.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() in ("true", "1"))
        return qs.order_by("category", "display_order", "name")


class AmenityDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AmenitySerializer
    queryset = Amenity.objects.all()


class SpeciesListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsSpeciesSerializer

    def get_queryset(self):
        return TargetSpecies.objects.all().order_by("category", "common_name")


class SpeciesDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperationsSpeciesSerializer
    queryset = TargetSpecies.objects.all()
    lookup_field = "slug"


class AllInclusivePackageListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AllInclusivePackageSerializer

    def get_queryset(self):
        qs = AllInclusivePackage.objects.all().prefetch_related("expeditions")
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() in ("true", "1"))
        return qs.order_by("name")


class AllInclusivePackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AllInclusivePackageSerializer
    queryset = AllInclusivePackage.objects.all().prefetch_related("expeditions")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.expeditions.exists():
            return Response(
                {"detail": "Não é possível excluir pacote vinculado a expedições. Desative o pacote (active=false) para impedir novos usos."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class BeveragePackageListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BeveragePackageSerializer

    def get_queryset(self):
        qs = BeveragePackage.objects.all().prefetch_related("items__product", "expeditions")
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() in ("true", "1"))
        return qs.order_by("name")


class BeveragePackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BeveragePackageSerializer
    queryset = BeveragePackage.objects.all().prefetch_related("items__product", "expeditions")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.expeditions.exists():
            return Response(
                {"detail": "Não é possível excluir pacote de bebidas vinculado a expedições. Desative o pacote (active=false) para impedir novos usos."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class BeveragePackageItemView(APIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, package_id):
        try:
            package = BeveragePackage.objects.get(id=package_id)
        except BeveragePackage.DoesNotExist:
            return Response({"detail": "Pacote de bebidas não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        product_id = request.data.get("product_id") or request.data.get("product")
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Produto não encontrado."}, status=status.HTTP_400_BAD_REQUEST)

        qty = int(request.data.get("standard_quantity_per_participant", 1))
        order = int(request.data.get("display_order", 0))
        note = str(request.data.get("note", ""))

        item, created = BeveragePackageItem.objects.update_or_create(
            package=package,
            product=product,
            defaults={
                "standard_quantity_per_participant": qty,
                "display_order": order,
                "note": note,
            },
        )
        return Response(BeveragePackageItemSerializer(item).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, package_id):
        product_id = request.data.get("product_id") or request.query_params.get("product_id")
        if not product_id:
            return Response({"detail": "product_id é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = BeveragePackageItem.objects.filter(package_id=package_id, product_id=product_id).delete()
        if not deleted:
            return Response({"detail": "Item não encontrado no pacote."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductListView(APIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = Product.objects.filter(active=True).order_by("category", "name")
        return Response([
            {"id": p.id, "name": p.name, "category": p.category, "unit": p.unit, "package_size": p.package_size}
            for p in products
        ])


class ReservationDetailView(OperationsView):
    def get(self, request, reservation_id):
        try:
            item = Reservation.objects.select_related("customer", "expedition").prefetch_related("participants__product_choices__expedition_product__product", "participants__dietary_restrictions__restriction", "participants__checklist_completions__item", "gear_addons__gear_product", "gear_addons__participant", "payments", "events").get(id=reservation_id)
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
        "products": [{"id": p.id, "name": p.name, "unit": p.unit, "package_size": p.package_size, "aliases": p.aliases, "active": p.active} for p in Product.objects.filter(active=True).order_by("name")],
        "offers": [{"id": o.id, "product_id": o.product_id, "name": o.product.name, "standard_quantity_per_participant": o.standard_quantity_per_participant, "display_order": o.display_order, "note": o.note, "active": o.active, "updated_at": o.updated_at} for o in expedition.product_offers.filter(product__active=True).select_related("product")],
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


class ParticipantUpdateView(OperationsView):
    @transaction.atomic
    def patch(self, request, reservation_id, participant_id):
        serializer = ParticipantUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id)
            participant = ReservationParticipant.objects.select_for_update().get(id=participant_id, reservation=reservation)
        except (Reservation.DoesNotExist, ReservationParticipant.DoesNotExist):
            return Response({"detail": "Reserva ou participante não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        data = serializer.validated_data
        is_sub = data.get("is_substitution", False)
        sub_reason = data.get("substitution_reason", "").strip()

        if is_sub:
            old_name = participant.full_name
            new_name = data.get("full_name", participant.full_name).strip()
            participant.full_name = new_name
            if "cpf" in data:
                participant.cpf = "".join(c for c in data["cpf"] if c.isdigit())
            if "phone" in data:
                participant.phone = data["phone"]
            if "birth_date" in data:
                participant.birth_date = data["birth_date"]
            if "emergency_contact_name" in data:
                participant.emergency_contact_name = data["emergency_contact_name"]
            if "emergency_contact_phone" in data:
                participant.emergency_contact_phone = data["emergency_contact_phone"]
            if "operational_notes" in data:
                participant.operational_notes = data["operational_notes"]

            # Reset preferences and onboarding for replaced participant
            participant.onboarding_status = ReservationParticipant.OnboardingStatus.PENDING
            participant.completed_at = None
            participant.product_choices_confirmed_at = None
            participant.dietary_confirmed_at = None
            participant.dietary_details = ""
            participant.dietary_restrictions.all().delete()
            participant.product_choices.all().delete()
            participant.checklist_completions.all().delete()
            participant.save()

            record_reservation_event(
                reservation=reservation,
                event_type="PARTICIPANT_SUBSTITUTED",
                actor_type=ReservationEvent.ActorType.ADMIN,
                actor_identifier="operations",
                reason=sub_reason or f"Substituição de {old_name} por {new_name}",
                payload={"participant_id": str(participant.id), "previous_name": old_name, "new_name": new_name},
            )
        else:
            updated_fields = []
            for field in ("full_name", "phone", "birth_date", "emergency_contact_name", "emergency_contact_phone", "operational_notes", "onboarding_status"):
                if field in data:
                    setattr(participant, field, data[field])
                    updated_fields.append(field)
            if "cpf" in data:
                participant.cpf = "".join(c for c in data["cpf"] if c.isdigit())
                updated_fields.append("cpf")
            participant.save()

            record_reservation_event(
                reservation=reservation,
                event_type="PARTICIPANT_UPDATED",
                actor_type=ReservationEvent.ActorType.ADMIN,
                actor_identifier="operations",
                reason="Atualização cadastral do participante",
                payload={"participant_id": str(participant.id), "updated_fields": updated_fields},
            )

        refreshed = Reservation.objects.select_related("customer", "expedition").prefetch_related(
            "participants__product_choices__expedition_product__product",
            "participants__dietary_restrictions__restriction",
            "participants__checklist_completions",
            "gear_addons__gear_product",
            "gear_addons__participant",
            "payments",
            "events",
            "expedition__checklist_items",
        ).get(id=reservation.id)
        return Response(OperationsReservationSerializer(refreshed).data)


class ExpeditionManifestView(OperationsView):
    format = "json"

    def get(self, request, expedition_id):
        try:
            expedition = Expedition.objects.select_related("lodge").get(id=expedition_id)
        except Expedition.DoesNotExist:
            return Response({"detail": "Expedição não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        valid_states = (Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.PARTIALLY_PAID)
        reservations = (
            Reservation.objects.filter(expedition=expedition, status__in=valid_states)
            .select_related("customer")
            .prefetch_related(
                "participants__dietary_restrictions__restriction",
                "participants__gear_addons__gear_product",
                "gear_addons__gear_product",
            )
            .order_by("created_at")
        )

        passengers = []
        for res in reservations:
            for p in res.participants.all():
                p_gear = [
                    {
                        "id": str(g.id),
                        "gear_name": g.gear_product.name,
                        "category": g.gear_product.category,
                        "modality": g.modality,
                        "quantity": g.quantity,
                        "delivered": g.delivered,
                    }
                    for g in p.gear_addons.all()
                ]
                passengers.append({
                    "id": str(p.id),
                    "name": p.full_name,
                    "cpf": p.cpf,
                    "phone": p.phone,
                    "birth_date": str(p.birth_date) if p.birth_date else "",
                    "emergency_contact_name": p.emergency_contact_name,
                    "emergency_contact_phone": p.emergency_contact_phone,
                    "operational_notes": p.operational_notes,
                    "onboarding_status": p.onboarding_status,
                    "dietary_restrictions": [r.restriction.name for r in p.dietary_restrictions.all()],
                    "dietary_details": p.dietary_details,
                    "reservation_id": str(res.id),
                    "customer_name": res.customer.full_name,
                    "customer_phone": res.customer.phone,
                    "reservation_status": res.status,
                    "gear_addons": p_gear,
                })

        gear_items = (
            ReservationGearAddon.objects.filter(
                reservation__expedition=expedition,
                reservation__status__in=valid_states,
            )
            .values("gear_product__id", "gear_product__name", "gear_product__category", "modality")
            .annotate(
                total_quantity=Sum("quantity"),
                delivered_quantity=Sum(
                    Case(
                        When(delivered=True, then=F("quantity")),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                ),
            )
            .order_by("gear_product__name")
        )
        gear_summary = [
            {
                "gear_product_id": str(item["gear_product__id"]),
                "name": item["gear_product__name"],
                "category": item["gear_product__category"],
                "modality": item["modality"],
                "total_quantity": item["total_quantity"] or 0,
                "delivered_quantity": item["delivered_quantity"] or 0,
            }
            for item in gear_items
        ]

        if self.format == "json":
            return Response({
                "expedition": {
                    "id": str(expedition.id),
                    "name": expedition.name,
                    "slug": expedition.slug,
                    "destination": expedition.destination,
                    "departure_location": expedition.departure_location,
                    "lodge_name": expedition.lodge.name if expedition.lodge else expedition.destination,
                    "starts_at": str(expedition.starts_at),
                    "ends_at": str(expedition.ends_at),
                    "capacity": expedition.capacity,
                    "total_passengers": len(passengers),
                },
                "passengers": passengers,
                "gear_summary": gear_summary,
                "generated_at": timezone.now().isoformat(),
            })

        def safe_csv(val):
            text = str(val or "")
            return "'" + text if text.startswith(("=", "+", "-", "@")) else text

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow((
            "Nº",
            "Nome Completo",
            "CPF",
            "Telefone",
            "Data de Nascimento",
            "Contato de Emergência",
            "Telefone de Emergência",
            "Restrições Alimentares",
            "Detalhes da Restrição",
            "Status da Ficha",
            "Titular da Reserva",
            "Telefone do Titular",
            "Tralhas / Equipamentos",
        ))
        for index, p in enumerate(passengers, start=1):
            dietary_str = ", ".join(p["dietary_restrictions"])
            gear_str = ", ".join(f"{g['quantity']}x {g['gear_name']} ({g['modality']})" for g in p["gear_addons"])
            writer.writerow((
                index,
                safe_csv(p["name"]),
                safe_csv(p["cpf"]),
                safe_csv(p["phone"]),
                safe_csv(p["birth_date"]),
                safe_csv(p["emergency_contact_name"]),
                safe_csv(p["emergency_contact_phone"]),
                safe_csv(dietary_str),
                safe_csv(p["dietary_details"]),
                safe_csv(p["onboarding_status"]),
                safe_csv(p["customer_name"]),
                safe_csv(p["customer_phone"]),
                safe_csv(gear_str),
            ))

        response = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="manifesto-{expedition.slug}.csv"'
        return response


class ExpeditionManifestCsvView(ExpeditionManifestView):
    format = "csv"


class FishingGearProductListCreateView(generics.ListCreateAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FishingGearProductSerializer

    def get_queryset(self):
        qs = FishingGearProduct.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        modality = self.request.query_params.get("modality")
        if modality:
            qs = qs.filter(modality__in=[modality, "BOTH"])
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() in ("true", "1"))
        query = self.request.query_params.get("q", "").strip()
        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(description__icontains=query))
        return qs.order_by("category", "name")


class FishingGearProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    authentication_classes = [OperationsAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FishingGearProductSerializer
    queryset = FishingGearProduct.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        active_statuses = [
            Reservation.Status.CONFIRMED,
            Reservation.Status.PAID,
            Reservation.Status.PARTIALLY_PAID,
            Reservation.Status.HELD,
            Reservation.Status.AWAITING_PAYMENT,
        ]
        if instance.addons.filter(reservation__status__in=active_statuses).exists():
            return Response(
                {"detail": "Não é possível excluir equipamento vinculado a reservas ativas. Desative o item (active=false) para impedir novas locações/vendas."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class ReservationGearAddonView(OperationsView):
    def get(self, request, reservation_id):
        try:
            reservation = Reservation.objects.get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        addons = reservation.gear_addons.select_related("gear_product", "participant").all().order_by("created_at")
        return Response(ReservationGearAddonSerializer(addons, many=True).data)

    @transaction.atomic
    def post(self, request, reservation_id):
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if reservation.status in (Reservation.Status.CANCELLED, Reservation.Status.REFUNDED, Reservation.Status.EXPIRED):
            return Response(
                {"detail": f"Não é possível adicionar equipamentos a uma reserva com status {reservation.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        gear_product_id = request.data.get("gear_product_id")
        if not gear_product_id:
            return Response({"detail": "gear_product_id é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gear_product = FishingGearProduct.objects.select_for_update().get(id=gear_product_id)
        except FishingGearProduct.DoesNotExist:
            return Response({"detail": "Equipamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if not gear_product.active:
            return Response({"detail": "Este equipamento está inativo e não pode ser reservado."}, status=status.HTTP_400_BAD_REQUEST)

        modality = str(request.data.get("modality", "RENTAL")).upper()
        if modality not in ("RENTAL", "SALE"):
            return Response({"detail": "Modalidade deve ser RENTAL ou SALE."}, status=status.HTTP_400_BAD_REQUEST)

        if modality == "RENTAL" and gear_product.modality not in ("RENTAL", "BOTH"):
            return Response({"detail": "Este equipamento não está disponível para locação."}, status=status.HTTP_400_BAD_REQUEST)
        if modality == "SALE" and gear_product.modality not in ("SALE", "BOTH"):
            return Response({"detail": "Este equipamento não está disponível para venda."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = int(request.data.get("quantity", 1))
            if quantity <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({"detail": "Quantidade deve ser um número inteiro positivo."}, status=status.HTTP_400_BAD_REQUEST)

        if gear_product.inventory_quantity < quantity:
            return Response(
                {"detail": f"Estoque insuficiente de '{gear_product.name}'. Disponível: {gear_product.inventory_quantity}, Solicitado: {quantity}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant_id = request.data.get("participant_id")
        participant = None
        if participant_id:
            try:
                participant = reservation.participants.get(id=participant_id)
            except ReservationParticipant.DoesNotExist:
                return Response({"detail": "Participante informado não pertence a esta reserva."}, status=status.HTTP_400_BAD_REQUEST)

        unit_price_cents = request.data.get("unit_price_cents")
        if unit_price_cents is not None and int(unit_price_cents) >= 0:
            unit_price_cents = int(unit_price_cents)
        else:
            if modality == "RENTAL":
                unit_price_cents = gear_product.rental_price_cents or 0
            else:
                unit_price_cents = gear_product.sale_price_cents or 0

        total_price_cents = unit_price_cents * quantity
        notes = str(request.data.get("notes", "")).strip()

        # Stock decrement
        gear_product.inventory_quantity -= quantity
        gear_product.save(update_fields=["inventory_quantity"])

        addon = ReservationGearAddon.objects.create(
            reservation=reservation,
            participant=participant,
            gear_product=gear_product,
            modality=modality,
            quantity=quantity,
            unit_price_cents=unit_price_cents,
            total_price_cents=total_price_cents,
            notes=notes,
        )

        admin_actor = getattr(request.user, "email", None) or getattr(request.user, "username", None) or "operations"
        recalculate_reservation_financials(
            reservation=reservation,
            admin_actor=str(admin_actor),
            note=f"Adicionado {quantity}x {gear_product.name} ({modality}) - R$ {total_price_cents/100:.2f}",
        )

        return Response(ReservationGearAddonSerializer(addon).data, status=status.HTTP_201_CREATED)


class ReservationGearAddonDetailView(OperationsView):
    def patch(self, request, reservation_id, addon_id):
        try:
            addon = ReservationGearAddon.objects.select_related("gear_product", "participant").get(
                id=addon_id, reservation_id=reservation_id
            )
        except ReservationGearAddon.DoesNotExist:
            return Response({"detail": "Item de equipamento não encontrado na reserva."}, status=status.HTTP_404_NOT_FOUND)

        if "delivered" in request.data:
            delivered = bool(request.data["delivered"])
            addon.delivered = delivered
            addon.delivered_at = timezone.now() if delivered else None

        if "notes" in request.data:
            addon.notes = str(request.data["notes"]).strip()

        addon.save()
        return Response(ReservationGearAddonSerializer(addon).data)

    @transaction.atomic
    def delete(self, request, reservation_id, addon_id):
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        try:
            addon = ReservationGearAddon.objects.select_for_update().select_related("gear_product").get(
                id=addon_id, reservation=reservation
            )
        except ReservationGearAddon.DoesNotExist:
            return Response({"detail": "Item de equipamento não encontrado na reserva."}, status=status.HTTP_404_NOT_FOUND)

        gear_product = FishingGearProduct.objects.select_for_update().get(id=addon.gear_product_id)
        restored_qty = addon.quantity
        gear_name = gear_product.name

        # Restore inventory
        gear_product.inventory_quantity += restored_qty
        gear_product.save(update_fields=["inventory_quantity"])

        addon.delete()

        admin_actor = getattr(request.user, "email", None) or getattr(request.user, "username", None) or "operations"
        recalculate_reservation_financials(
            reservation=reservation,
            admin_actor=str(admin_actor),
            note=f"Removido {restored_qty}x {gear_name} (estoque restaurado: +{restored_qty})",
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerListView(OperationsView):
    def get(self, request):
        paid_subquery = Payment.objects.filter(
            reservation__customer=OuterRef("pk"),
            status=Payment.Status.PAID,
        ).exclude(
            reservation__status__in=[Reservation.Status.CANCELLED, Reservation.Status.REFUNDED, Reservation.Status.EXPIRED],
        ).values("reservation__customer").annotate(
            total=Sum("amount_cents")
        ).values("total")

        active_statuses = [
            Reservation.Status.CONFIRMED,
            Reservation.Status.PAID,
            Reservation.Status.PARTIALLY_PAID,
        ]

        reservations_subquery = Reservation.objects.filter(
            customer=OuterRef("pk"),
            status__in=active_statuses,
        ).values("customer").annotate(
            count=Count("id")
        ).values("count")

        last_expedition_name_subquery = Reservation.objects.filter(
            customer=OuterRef("pk"),
            status__in=active_statuses,
        ).order_by("-expedition__starts_at").values("expedition__name")[:1]

        last_expedition_date_subquery = Reservation.objects.filter(
            customer=OuterRef("pk"),
            status__in=active_statuses,
        ).order_by("-expedition__starts_at").values("expedition__starts_at")[:1]

        queryset = Customer.objects.select_related("profile").annotate(
            lifetime_value_cents=Coalesce(Subquery(paid_subquery), Value(0)),
            total_reservations=Coalesce(Subquery(reservations_subquery), Value(0)),
            last_expedition_name=Subquery(last_expedition_name_subquery),
            last_expedition_date=Subquery(last_expedition_date_subquery),
        )

        q = request.query_params.get("q", "").strip()
        if q:
            digits = "".join(c for c in q if c.isdigit())
            search = Q(full_name__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q)
            if digits:
                search |= Q(cpf__icontains=digits)
            queryset = queryset.filter(search)

        has_valid_license = request.query_params.get("has_license")
        if has_valid_license is not None:
            today = timezone.localdate()
            if has_valid_license.lower() in ("true", "1"):
                queryset = queryset.filter(
                    profile__fishing_license_number__isnull=False,
                    profile__fishing_license_expiry__gte=today,
                ).exclude(profile__fishing_license_number="")
            else:
                queryset = queryset.filter(
                    Q(profile__isnull=True)
                    | Q(profile__fishing_license_number="")
                    | Q(profile__fishing_license_number__isnull=True)
                    | Q(profile__fishing_license_expiry__lt=today)
                    | Q(profile__fishing_license_expiry__isnull=True)
                )

        ordering = request.query_params.get("ordering", "-created_at")
        if ordering == "-ltv":
            queryset = queryset.order_by("-lifetime_value_cents", "-created_at")
        elif ordering == "name":
            queryset = queryset.order_by("full_name")
        else:
            queryset = queryset.order_by("-created_at")

        return Response(AdminCustomerListSerializer(queryset[:150], many=True).data)


class CustomerDetailView(OperationsView):
    def get(self, request, customer_id):
        try:
            customer = Customer.objects.select_related("profile").prefetch_related(
                "reservations__expedition",
                "reservations__gear_addons__gear_product",
                "reservations__payments",
            ).get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({"detail": "Cliente não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminCustomerDetailSerializer(customer).data)

    @transaction.atomic
    def patch(self, request, customer_id):
        try:
            customer = Customer.objects.select_for_update().get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({"detail": "Cliente não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        for field in ("full_name", "email", "phone"):
            if field in request.data:
                setattr(customer, field, str(request.data[field]).strip())
        customer.save()

        profile, _ = CustomerProfile.objects.get_or_create(customer=customer)
        profile_fields = (
            "rg", "rg_issuer", "birth_date", "city", "state",
            "fishing_license_number", "fishing_license_expiry",
            "default_vest_size", "dietary_notes", "medical_notes",
            "emergency_contact_name", "emergency_contact_phone",
            "internal_admin_notes",
        )
        profile_data = request.data.get("profile", request.data)
        updated_profile = False
        for field in profile_fields:
            if field in profile_data:
                val = profile_data[field]
                if field in ("birth_date", "fishing_license_expiry") and not val:
                    val = None
                setattr(profile, field, val)
                updated_profile = True

        if updated_profile:
            profile.save()

        customer.refresh_from_db()
        return Response(AdminCustomerDetailSerializer(customer).data)
