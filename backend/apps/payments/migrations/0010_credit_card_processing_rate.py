from decimal import Decimal

from django.db import migrations
from django.utils import timezone


def adopt_account_credit_rate(apps, schema_editor):
    FeeRate = apps.get_model("payments", "FeeRate")
    FeeRateAudit = apps.get_model("payments", "FeeRateAudit")
    database = schema_editor.connection.alias
    for rate in FeeRate.objects.using(database).filter(method="CREDIT_CARD", active=True):
        before = {"method": rate.method, "installments": rate.installments, "percent": str(rate.percent),
                  "fixed_cents": rate.fixed_cents, "version": rate.version, "source": rate.source,
                  "estimated": rate.estimated, "active": rate.active, "updated_by": rate.updated_by}
        previous_version = rate.version
        rate.revoked_versions = sorted(set([*rate.revoked_versions, previous_version]))
        rate.version = previous_version + 1
        rate.percent = Decimal("4.9800")
        # The account confirmed 4.98%, but did not confirm whether a fixed fee exists.
        rate.estimated = True
        if rate.updated_by == "seed-public-estimate-2026-11-06":
            rate.source = ""
        rate.source_checked_at = timezone.now()
        rate.updated_by = "owner-confirmed-credit-2026-11-07"
        rate.save(using=database, update_fields=["revoked_versions", "version", "percent", "estimated", "source", "source_checked_at", "updated_by", "updated_at"])
        after = {"method": rate.method, "installments": rate.installments, "percent": str(rate.percent),
                 "fixed_cents": rate.fixed_cents, "version": rate.version, "source": rate.source,
                 "estimated": rate.estimated, "active": rate.active, "updated_by": rate.updated_by}
        FeeRateAudit.objects.using(database).create(rate=rate, before=before, after=after, actor=rate.updated_by)


class Migration(migrations.Migration):
    dependencies = [("payments", "0009_fee_rate_percent_valid")]

    operations = [migrations.RunPython(adopt_account_credit_rate, migrations.RunPython.noop)]
