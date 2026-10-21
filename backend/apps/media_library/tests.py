import io
from pathlib import Path
import tempfile
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.test import TransactionTestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.operations.authentication import create_admin_token
from .models import MediaAsset
from .services import MAX_FILE_BYTES, asset_path


def photo(fmt="PNG", size=(800, 600), **save_options):
    stream = io.BytesIO()
    Image.new("RGB", size, "green").save(stream, format=fmt, **save_options)
    return SimpleUploadedFile("foto." + fmt.lower(), stream.getvalue(), content_type="application/octet-stream")


class MediaLibraryTests(TransactionTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.override = override_settings(MEDIA_ROOT=self.directory.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.client = APIClient()
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {create_admin_token()}"}

    def upload(self, file):
        return self.client.post("/api/operations/media/", {"file": file}, format="multipart", **self.auth)

    def test_anonymous_cannot_list_or_upload(self):
        self.assertEqual(self.client.get("/api/operations/media/").status_code, 403)
        self.assertEqual(self.client.post("/api/operations/media/", {"file": photo()}, format="multipart").status_code, 403)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_supported_formats_content_and_head(self):
        for fmt in ("JPEG", "PNG", "WEBP"):
            with self.subTest(fmt=fmt):
                result = self.upload(photo(fmt))
                self.assertEqual(result.status_code, 201, result.data)
                asset = MediaAsset.objects.get(pk=result.data["id"])
                self.assertEqual(asset.created_by, settings.ADMIN_EMAIL)
                self.assertEqual((asset.width, asset.height), (800, 600))
                image = self.client.get(result.data["url"])
                self.assertEqual(image.status_code, 200)
                self.assertEqual(image["Content-Type"], "image/webp")
                stream = io.BytesIO(b"".join(image.streaming_content))
                self.assertEqual(Image.open(stream).format, "WEBP")
                thumb = Image.open(asset_path(asset.id, "thumbnail"))
                self.assertLessEqual(max(thumb.size), 400)
                thumb.close()
                head = self.client.head(result.data["url"])
                self.assertEqual(head.status_code, 200)
                self.assertEqual(int(head["Content-Length"]), asset.byte_size)
                head.close()

    def test_image_orientation_metadata_and_resizing(self):
        exif = Image.Exif()
        exif[274] = 6  # rotate 90 degrees
        exif[315] = "private author"
        result = self.upload(photo("JPEG", (3000, 30), exif=exif))
        self.assertEqual(result.status_code, 201, result.data)
        asset = MediaAsset.objects.get(pk=result.data["id"])
        self.assertEqual((asset.width, asset.height), (24, 2400))
        with Image.open(asset_path(asset.id, "image")) as image:
            self.assertFalse(image.getexif())
            self.assertNotIn("exif", image.info)
            self.assertNotIn("xmp", image.info)

    def test_transparency_is_preserved(self):
        stream = io.BytesIO()
        Image.new("RGBA", (10, 10), (255, 0, 0, 0)).save(stream, format="PNG")
        result = self.upload(SimpleUploadedFile("a.png", stream.getvalue()))
        self.assertEqual(result.status_code, 201)
        with Image.open(asset_path(result.data["id"], "image")) as image:
            self.assertEqual(image.getpixel((0, 0))[3], 0)

    def test_invalid_truncated_and_unsupported_files_create_nothing(self):
        for file in (SimpleUploadedFile("fake.png", b"<svg><script/></svg>"), photo("GIF"),
                     SimpleUploadedFile("broken.jpg", photo("JPEG").read()[:50])):
            with self.subTest(name=file.name):
                self.assertEqual(self.upload(file).status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_animation_is_rejected(self):
        stream = io.BytesIO()
        first = Image.new("RGB", (10, 10), "red")
        first.save(stream, format="PNG", save_all=True, append_images=[Image.new("RGB", (10, 10), "blue")], duration=100)
        self.assertEqual(self.upload(SimpleUploadedFile("animated.png", stream.getvalue())).status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    def test_dimension_and_pixel_limits(self):
        self.assertEqual(self.upload(photo(size=(12001, 1))).status_code, 400)
        self.assertEqual(self.upload(photo(size=(5000, 5000))).status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    def test_byte_limit_rejects_before_decode(self):
        with patch("apps.media_library.views.create_asset") as create:
            result = self.upload(SimpleUploadedFile("huge.jpg", b"x" * (MAX_FILE_BYTES + 1)))
            self.assertEqual(result.status_code, 413)
            create.assert_not_called()

    def test_database_failure_removes_files(self):
        with patch.object(MediaAsset, "save", side_effect=DatabaseError("unavailable")):
            self.assertEqual(self.upload(photo()).status_code, 503)
        self.assertFalse(MediaAsset.objects.exists())
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_write_failure_does_not_publish_partial_asset(self):
        with patch.object(Path, "open", side_effect=PermissionError("unavailable")):
            self.assertEqual(self.upload(photo()).status_code, 503)
        self.assertFalse(MediaAsset.objects.exists())
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_unknown_variant_missing_file_and_write_methods(self):
        result = self.upload(photo())
        url = result.data["url"]
        self.assertEqual(self.client.get(url.replace("/image/", "/original/")).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 405)
        asset_path(result.data["id"], "image").unlink()
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_library_pagination_and_no_private_identity_in_payload(self):
        for index in range(25):
            MediaAsset.objects.create(original_name=f"{index}.jpg", width=10, height=10, byte_size=100, created_by="private@example.com")
        first = self.client.get("/api/operations/media/?page=1", **self.auth)
        second = self.client.get("/api/operations/media/?page=2", **self.auth)
        self.assertEqual(len(first.data["results"]), 24)
        self.assertEqual(len(second.data["results"]), 1)
        self.assertEqual(first.data["count"], 25)
        self.assertNotIn("created_by", first.data["results"][0])
