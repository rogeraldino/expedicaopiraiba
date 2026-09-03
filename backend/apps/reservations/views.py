from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import HoldSerializer, IdentifySerializer, VerifySerializer


class SerializerActionView(APIView):
    serializer_class = None

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.create(serializer.validated_data)
        return Response(result, status=status.HTTP_201_CREATED)


class IdentifyView(SerializerActionView):
    serializer_class = IdentifySerializer


class VerifyView(SerializerActionView):
    serializer_class = VerifySerializer


class HoldView(SerializerActionView):
    serializer_class = HoldSerializer
