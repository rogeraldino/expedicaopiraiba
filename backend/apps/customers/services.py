import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Customer, VerificationChallenge
from .notifications import send_otp_email, send_otp_whatsapp
from .validators import normalize_phone, validate_cpf

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
CUSTOMER_SESSION_SALT = "customer-session"
GUEST_PARTICIPANT_SALT = "guest-participant-token"


def mask_destination(val: str, channel: str) -> str:
    """
    Masks email or phone number for safe public display in API responses.
    """
    if not val:
        return ""
    if channel == VerificationChallenge.Channel.EMAIL or "@" in val:
        parts = val.split("@", 1)
        user = parts[0]
        domain = parts[1] if len(parts) > 1 else ""
        masked_user = user[:2] + "***" if len(user) > 2 else user[:1] + "***"
        return f"{masked_user}@{domain}"
    digits = "".join(c for c in val if c.isdigit())
    if len(digits) >= 10:
        ddd = digits[:2]
        last4 = digits[-4:]
        return f"({ddd}) 9****-{last4}"
    return val[:3] + "****" + val[-2:]


@transaction.atomic
def start_verification(*, cpf, full_name, email, phone, channel=None):
    """
    Initiates customer verification challenge.
    Does NOT overwrite existing customer's data before verification.
    Dispatches OTP via Email (or WhatsApp).
    """
    normalized_cpf = validate_cpf(cpf)
    normalized_phone = normalize_phone(phone)
    clean_email = email.lower().strip()
    clean_name = full_name.strip()

    customer, created = Customer.objects.select_for_update().get_or_create(
        cpf=normalized_cpf,
        defaults={
            "full_name": clean_name,
            "email": clean_email,
            "phone": normalized_phone,
        },
    )

    chosen_channel = channel or VerificationChallenge.Channel.EMAIL
    # Check if existing customer has verified contact
    destination_email = customer.email if not created else clean_email
    destination_phone = customer.phone if not created else normalized_phone

    # Revoke unconsumed challenges
    VerificationChallenge.objects.filter(customer=customer, verified_at__isnull=True).delete()

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = VerificationChallenge.objects.create(
        customer=customer,
        channel=chosen_channel,
        code_digest=make_password(code),
        pending_full_name=clean_name if not created else "",
        pending_email=clean_email if not created else "",
        pending_phone=normalized_phone if not created else "",
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    )

    # Dispatch notification
    dispatched = False
    if chosen_channel == VerificationChallenge.Channel.EMAIL:
        dispatched = send_otp_email(email=destination_email, code=code, full_name=customer.full_name)
    elif chosen_channel == VerificationChallenge.Channel.WHATSAPP:
        dispatched = send_otp_whatsapp(phone=destination_phone, code=code, full_name=customer.full_name)
        if not dispatched:
            # Fallback to email
            dispatched = send_otp_email(email=destination_email, code=code, full_name=customer.full_name)
            challenge.channel = VerificationChallenge.Channel.EMAIL
            challenge.save(update_fields=["channel"])

    destination = destination_email if challenge.channel == VerificationChallenge.Channel.EMAIL else destination_phone
    masked = mask_destination(destination, challenge.channel)
    return challenge, code, masked


def verify_challenge(*, challenge_id, code):
    """
    Verifies challenge with durable attempts tracking (no rollback bug).
    Commits attempts increment even on invalid code.
    Applies pending contact updates only upon successful verification.
    """
    try:
        challenge = VerificationChallenge.objects.select_related("customer").get(id=challenge_id)
    except (VerificationChallenge.DoesNotExist, ValidationError):
        raise ValidationError("Código inválido ou expirado.")

    now = timezone.now()
    if challenge.verified_at or challenge.expires_at <= now or challenge.attempts >= MAX_ATTEMPTS:
        raise ValidationError("Código expirado ou limite de tentativas excedido. Solicite um novo código.")

    # Check code match
    if not check_password(str(code), challenge.code_digest):
        # Update attempts durably outside the atomic block
        VerificationChallenge.objects.filter(id=challenge_id).update(attempts=F("attempts") + 1)
        raise ValidationError("Código de verificação incorreto.")

    with transaction.atomic():
        challenge = VerificationChallenge.objects.select_for_update().select_related("customer").get(id=challenge_id)
        if challenge.verified_at or challenge.expires_at <= now or challenge.attempts >= MAX_ATTEMPTS:
            raise ValidationError("Código expirado ou limite de tentativas excedido.")

        challenge.attempts += 1
        challenge.verified_at = now
        challenge.consumed_at = now
        challenge.save(update_fields=("attempts", "verified_at", "consumed_at"))

        customer = challenge.customer
        update_fields = ["updated_at"]

        # Apply verified updates
        if challenge.pending_full_name and challenge.pending_full_name != customer.full_name:
            customer.full_name = challenge.pending_full_name
            update_fields.append("full_name")
        if challenge.pending_email and challenge.pending_email != customer.email:
            customer.email = challenge.pending_email
            update_fields.append("email")
        if challenge.pending_phone and challenge.pending_phone != customer.phone:
            customer.phone = challenge.pending_phone
            update_fields.append("phone")

        if challenge.channel == VerificationChallenge.Channel.EMAIL:
            customer.email_verified_at = now
            update_fields.append("email_verified_at")
        elif challenge.channel == VerificationChallenge.Channel.WHATSAPP:
            customer.phone_verified_at = now
            update_fields.append("phone_verified_at")

        customer.save(update_fields=update_fields)

        token = signing.dumps(
            {"challenge_id": str(challenge.id), "customer_id": str(challenge.customer_id)},
            salt="checkout-verification",
        )
        return token


def customer_from_token(token):
    try:
        payload = signing.loads(token, salt="checkout-verification", max_age=900)
        challenge = VerificationChallenge.objects.select_related("customer").get(
            id=payload["challenge_id"], customer_id=payload["customer_id"], verified_at__isnull=False
        )
    except (signing.BadSignature, signing.SignatureExpired, KeyError, VerificationChallenge.DoesNotExist, ValidationError):
        raise ValidationError("Verificação expirada. Solicite um novo código.")
    return challenge.customer


def create_customer_session_token(customer):
    return signing.dumps({"customer_id": str(customer.id)}, salt=CUSTOMER_SESSION_SALT, compress=True)


def customer_from_session_token(token):
    try:
        payload = signing.loads(token, salt=CUSTOMER_SESSION_SALT, max_age=60 * 60 * 24 * 30)
        return Customer.objects.get(id=payload["customer_id"])
    except (signing.BadSignature, signing.SignatureExpired, KeyError, Customer.DoesNotExist, ValidationError):
        raise ValidationError("Sessão expirada. Confirme seu contato novamente.")


def create_guest_participant_token(participant):
    """
    Creates guest participant token with token_version for revocation support.
    """
    return signing.dumps(
        {
            "participant_id": str(participant.id),
            "reservation_id": str(participant.reservation_id),
            "token_version": getattr(participant, "token_version", 1),
        },
        salt=GUEST_PARTICIPANT_SALT,
        compress=True,
    )


def participant_from_guest_token(token):
    """
    Resolves participant from guest token, rejecting revoked or replaced versions.
    """
    try:
        payload = signing.loads(token, salt=GUEST_PARTICIPANT_SALT, max_age=60 * 60 * 24 * 30)
        from apps.reservations.models import ReservationParticipant

        participant = ReservationParticipant.objects.select_related(
            "reservation__expedition", "reservation__customer"
        ).get(id=payload["participant_id"], reservation_id=payload["reservation_id"])
        expected_version = getattr(participant, "token_version", 1)
        if payload.get("token_version", 1) != expected_version:
            raise ValidationError("Este link de convidado foi revogado ou substituído.")
        return participant
    except (signing.BadSignature, signing.SignatureExpired, KeyError, Exception):
        raise ValidationError("Link de convidado inválido ou expirado.")


def start_portal_reaccess(*, cpf):
    """
    Initiates customer portal passwordless reaccess challenge.
    Sends OTP to the registered email/WhatsApp of the customer.
    Returns generic status to avoid customer enumeration.
    """
    clean_cpf = "".join(c for c in str(cpf) if c.isdigit())
    if len(clean_cpf) != 11:
        raise ValidationError("CPF deve conter 11 dígitos numéricos.")

    try:
        customer = Customer.objects.get(cpf=clean_cpf)
    except Customer.DoesNotExist:
        # Return generic challenge response without exposing whether CPF exists
        return "00000000-0000-0000-0000-000000000000", "CHALLENGE_CREATED", "Se houver uma reserva cadastrada para este CPF, um código foi enviado aos seus canais cadastrados."

    # Revoke unconsumed challenges
    VerificationChallenge.objects.filter(customer=customer, verified_at__isnull=True).delete()

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = VerificationChallenge.objects.create(
        customer=customer,
        channel=VerificationChallenge.Channel.EMAIL,
        code_digest=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    )

    send_otp_email(email=customer.email, code=code, full_name=customer.full_name)
    masked = mask_destination(customer.email, VerificationChallenge.Channel.EMAIL)
    return str(challenge.id), "CHALLENGE_CREATED", f"Código de confirmação enviado para {masked}."


def verify_portal_reaccess(*, challenge_id, code):
    """
    Validates portal reaccess OTP and returns customer and session token.
    """
    token = verify_challenge(challenge_id=challenge_id, code=code)
    customer = customer_from_token(token)
    session_token = create_customer_session_token(customer)
    return customer, session_token


def customer_lookup(*, cpf, phone):
    """
    Maintained for backward compatibility with existing tests;
    validates CPF and phone match and returns customer and session token.
    """
    clean_cpf = "".join(c for c in str(cpf) if c.isdigit())
    if len(clean_cpf) != 11:
        raise ValidationError("CPF deve conter 11 dígitos numéricos.")
    clean_phone = "".join(c for c in str(phone) if c.isdigit())
    if len(clean_phone) < 8:
        raise ValidationError("Informe um telefone ou WhatsApp válido com DDD.")

    try:
        customer = Customer.objects.get(cpf=clean_cpf)
    except Customer.DoesNotExist:
        raise ValidationError("Nenhuma reserva encontrada para o CPF informado.")

    customer_phone_digits = "".join(c for c in customer.phone if c.isdigit())
    phone_match = (
        clean_phone == customer_phone_digits
        or clean_phone[-8:] == customer_phone_digits[-8:]
        or clean_phone[-9:] == customer_phone_digits[-9:]
    )
    if not phone_match:
        from apps.reservations.models import ReservationParticipant

        has_pax_phone = ReservationParticipant.objects.filter(
            reservation__customer=customer
        ).filter(phone__icontains=clean_phone[-8:]).exists()
        if not has_pax_phone:
            raise ValidationError("Telefone não confere com o cadastro deste CPF.")

    token = create_customer_session_token(customer)
    return customer, token
