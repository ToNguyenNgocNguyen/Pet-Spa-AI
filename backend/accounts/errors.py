"""Định dạng lỗi thống nhất: {"code": "...", "detail": "tiếng Việt", "fields": {}}."""
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler

DEFAULT_MESSAGES = {
    'not_authenticated': 'Bạn chưa đăng nhập.',
    'authentication_failed': 'Thông tin đăng nhập không đúng.',
    'permission_denied': 'Bạn không có quyền thực hiện thao tác này.',
    'not_found': 'Không tìm thấy dữ liệu.',
    'method_not_allowed': 'Phương thức không được hỗ trợ.',
    'throttled': 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
}


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, exceptions.ValidationError):
        return Response(
            {'code': 'validation_error', 'detail': 'Dữ liệu không hợp lệ.', 'fields': response.data},
            status=422,
        )

    code = getattr(exc, 'default_code', 'error')
    if isinstance(exc, exceptions.APIException):
        code = exc.get_codes() if isinstance(exc.get_codes(), str) else code
    detail = DEFAULT_MESSAGES.get(code) or (
        response.data.get('detail') if isinstance(response.data, dict) else None
    ) or 'Có lỗi xảy ra.'
    return Response({'code': code, 'detail': str(detail), 'fields': {}}, status=response.status_code)


class Conflict(exceptions.APIException):
    """409: xung đột nghiệp vụ (trùng lịch, chuyển trạng thái sai...)."""

    status_code = 409
    default_code = 'conflict'
    default_detail = 'Thao tác xung đột với dữ liệu hiện có.'

    def __init__(self, code='conflict', detail=None):
        super().__init__(detail=detail, code=code)
