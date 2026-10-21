import io
import logging
from pathlib import Path
import warnings

from django.conf import settings
from django.db import DatabaseError, transaction
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import APIException, ValidationError

from .models import MediaAsset

logger = logging.getLogger(__name__)
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 24_000_000
MAX_DIMENSION = 12_000


class UploadTooLarge(APIException):
    status_code = 413
    default_detail = "A imagem deve ter no máximo 10 MB."


class MediaUnavailable(APIException):
    status_code = 503
    default_detail = "Não foi possível armazenar a imagem. Tente novamente."


def asset_path(asset_id, variant):
    # Neither component is a user filename. Views validate UUID and variant.
    return Path(settings.MEDIA_ROOT) / str(asset_id) / f"{variant}.webp"


def prepare_image(upload):
    if upload.size > MAX_FILE_BYTES:
        raise UploadTooLarge()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            upload.seek(0)
            with Image.open(upload) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValidationError("Use uma imagem JPEG, PNG ou WebP.")
                width, height = source.size
                if width * height > MAX_PIXELS or max(width, height) > MAX_DIMENSION:
                    raise ValidationError("A imagem excede o limite de 24 milhões de pixels ou 12.000 pixels por lado.")
                if getattr(source, "is_animated", False) or getattr(source, "n_frames", 1) != 1:
                    raise ValidationError("Envie uma imagem estática, sem animação.")
                source.verify()
            upload.seek(0)
            with Image.open(upload) as source:
                source.load()
                oriented = ImageOps.exif_transpose(source)
                mode = "RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB"
                # A fresh image copies only pixels: EXIF, comments, ICC and XMP
                # cannot travel into the public output.
                converted = oriented.convert(mode)
                image = Image.new(mode, converted.size)
                image.paste(converted)
                image.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
                thumb = image.copy()
                thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
                output = {}
                for variant, pixels in (("image", image), ("thumbnail", thumb)):
                    stream = io.BytesIO()
                    pixels.save(stream, format="WEBP", quality=85, method=4)
                    output[variant] = stream.getvalue()
                return output, image.size
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValidationError("Arquivo inválido ou imagem danificada. Use JPEG, PNG ou WebP.") from error


def create_asset(upload):
    images, (width, height) = prepare_image(upload)
    asset = MediaAsset(original_name=Path(upload.name).name[:255], width=width,
                       height=height, byte_size=len(images["image"]),
                       created_by=settings.ADMIN_EMAIL)
    directory = asset_path(asset.id, "image").parent
    written = []
    try:
        directory.mkdir(parents=True, exist_ok=False)
        for variant, content in images.items():
            path = asset_path(asset.id, variant)
            # Exclusive creation: a failed attempt must never replace an asset.
            with path.open("xb") as stream:
                written.append(path)
                stream.write(content)
        with transaction.atomic():
            asset.save(force_insert=True)
    except (OSError, DatabaseError) as error:
        for path in written:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.error("Could not clean uncommitted media file", exc_info=True)
        try:
            directory.rmdir()
        except OSError:
            pass
        logger.error("Media storage failed", exc_info=True)
        raise MediaUnavailable() from error
    return asset
