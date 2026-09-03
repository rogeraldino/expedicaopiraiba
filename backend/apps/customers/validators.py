import re

from django.core.exceptions import ValidationError


def digits(value):
    return re.sub(r"\D", "", value or "")


def validate_cpf(value):
    cpf = digits(value)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        raise ValidationError("CPF inválido.")
    for size in (9, 10):
        total = sum(int(cpf[index]) * (size + 1 - index) for index in range(size))
        check = (total * 10 % 11) % 10
        if check != int(cpf[size]):
            raise ValidationError("CPF inválido.")
    return cpf


def normalize_phone(value):
    phone = digits(value)
    if len(phone) < 8 or len(phone) > 15:
        raise ValidationError("Celular inválido. Informe DDD e número (ex: 62 99999-9999).")
    if len(phone) in (10, 11):
        phone = f"55{phone}"
    elif len(phone) in (8, 9):
        phone = f"5562{phone}"
    return phone
