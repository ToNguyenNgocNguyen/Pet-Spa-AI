from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import ReadAnyWriteManager

from .models import Spa
from .serializers import SpaSerializer


class SpaView(APIView):
    """GET spa (công khai) / PATCH spa (Quản lý). Không có POST/DELETE."""

    permission_classes = [ReadAnyWriteManager]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _spa(self):
        spa = Spa.get()
        if not spa:
            raise NotFound('Chưa khai báo hồ sơ spa.')
        return spa

    def get(self, request):
        return Response(SpaSerializer(self._spa(), context={'request': request}).data)

    def patch(self, request):
        s = SpaSerializer(self._spa(), data=request.data, partial=True, context={'request': request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)
