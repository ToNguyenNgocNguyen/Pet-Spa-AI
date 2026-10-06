# 08. API (Pha 1–2)

Tiền tố `/api/v1/`. Chỉ JSON. Quy ước lỗi và mã HTTP xem [07_kien_truc.md](07_kien_truc.md) mục 7.4.

Ký hiệu actor: **P** = công khai (không đăng nhập), **K** khách, **L** lễ tân, **T** kỹ thuật viên, **Q** quản lý. "Chủ" = chỉ dữ liệu của chính người gọi. "Được giao" = chỉ lịch gán cho kỹ thuật viên đó. AI Agent không gọi API; hệ thống gọi lớp AI bên trong các endpoint `ai/*`.

## 8.1 Xác thực và tài khoản (SPA-02, 03)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `auth/register` | P | Khách đăng ký (tạo `User` role `customer` + `Client`) |
| POST | `auth/login` | P | Trả token và thông tin vai trò |
| POST | `auth/logout` | K L T Q | Hủy token |
| GET, PATCH | `auth/me` | K L T Q | Xem/sửa tài khoản; khách sửa `allow_reminders` |
| POST | `auth/change-password` | K L T Q | Đổi mật khẩu |

## 8.2 Hồ sơ spa và nhân sự (SPA-01, 13, 14)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `spa` | P | Thông tin spa, giờ mở cửa |
| PATCH | `spa` | Q | Sửa hồ sơ spa (một bản ghi, không có POST/DELETE) |
| GET | `staff` | L T Q | Danh sách nhân viên (T chỉ thấy tên và chuyên môn) |
| POST | `staff` | Q | Mời nhân viên (tạo `User` + `StaffProfile`) |
| GET, PATCH | `staff/{id}` | Q; T chủ (sửa giờ rảnh) | Chi tiết, đổi chuyên môn/khóa |
| GET, PUT | `staff/{id}/shifts` | Q; T chủ | Giờ làm theo tuần |
| GET, POST, DELETE | `staff/{id}/time-off` | Q; T chủ | Ngày nghỉ |
| GET, POST, PATCH | `specialties` | GET: L T Q; ghi: Q | Chuyên môn |

## 8.3 Catalog và giá (SPA-04, 05, 06)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `services` | P | Danh sách dịch vụ đang hoạt động; Q xem cả đã ẩn |
| GET | `services/{id}` | P | Chi tiết kèm giá theo size |
| POST, PATCH | `services`, `services/{id}` | Q | Thêm/sửa/ẩn dịch vụ |
| PUT | `services/{id}/prices` | Q | Ghi đè giá theo size XS–XL |
| GET | `packages` | P | Gói kèm dịch vụ thành phần, giá theo size |
| POST, PATCH | `packages`, `packages/{id}` | Q | Thêm/sửa/ẩn gói |
| PUT | `packages/{id}/items` | Q | Dịch vụ trong gói và thứ tự |
| PUT | `packages/{id}/prices` | Q | Giá gói theo size |
| GET | `size-bands` | P | Bảng size theo cân nặng |
| PUT | `size-bands` | Q | Sửa bảng size |

## 8.4 Khách và thú (SPA-07, 08)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `clients` | L Q | Danh sách, tìm theo tên/SĐT |
| POST | `clients` | L Q | Tạo khách vãng lai |
| GET, PATCH | `clients/{id}` | L Q; K chủ | Chi tiết/sửa; xóa mềm bằng `is_active=false` |
| GET | `clients/me` | K | Hồ sơ khách của mình |
| GET | `pets` | L T Q; K chủ | Danh sách; T chỉ xem thú thuộc lịch được giao |
| POST | `pets` | K chủ; L Q | Thêm thú |
| GET, PATCH | `pets/{id}` | K chủ; L T Q | T chỉ sửa `safety_note`, `health_tags`, `allergy_note` |
| GET, POST, DELETE | `pets/{id}/vaccinations` | K chủ; L Q | Lịch sử tiêm phòng |
| GET | `health-tags` | K L T Q | Danh mục thẻ sức khỏe |
| POST, PATCH | `health-tags` | Q | Thêm/sửa thẻ |

## 8.5 Lịch hẹn và vận hành ngày (SPA-09 đến 17)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `bookings` | L Q; K chủ; T được giao | Danh sách có lọc `status`, `service`, `date_from`, `date_to`, `staff`, `q` |
| GET | `bookings/calendar` | L Q; T được giao | Dữ liệu lịch theo `from`, `to` (tháng/ngày) |
| GET | `bookings/availability` | K L Q | Slot còn trống theo `date`, `service_ids`/`package_id`, `pet_id` |
| POST | `bookings/quote` | K L Q | Tính giá theo size và trả cảnh báo chống chỉ định, chưa lưu |
| POST | `bookings` | K L Q | Đặt lịch; K tạo `pending`, L/Q tạo `pending` hoặc `confirmed`. Nhận `source_suggestion_id` tùy chọn |
| GET | `bookings/{id}` | L Q; K chủ; T được giao | Chi tiết: thú, dịch vụ, ghi chú, huy hiệu an toàn, hóa đơn |
| PATCH | `bookings/{id}` | L Q; K chủ (khi `pending`/`confirmed`) | Sửa giờ, dịch vụ, ghi chú; kiểm tra lại trùng |
| POST | `bookings/{id}/confirm` | L Q | `pending → confirmed` |
| POST | `bookings/{id}/reject` | L Q | `pending → cancelled`, body `reason` bắt buộc |
| POST | `bookings/{id}/cancel` | K chủ (đúng hạn); L Q | `→ cancelled`, body `reason`, `reason_code` |
| POST | `bookings/{id}/assign-staff` | L Q | Gán/đổi kỹ thuật viên |
| POST | `bookings/{id}/check-in` | L | `confirmed → checked_in`, body gán `resource_id` cho từng item |
| POST | `bookings/{id}/start` | T được giao | `checked_in → in_progress` |
| POST | `bookings/{id}/complete` | T được giao | `in_progress → completed`, sinh hóa đơn |
| POST | `bookings/{id}/check-out` | L | Ghi `checked_out_at` |
| POST | `bookings/{id}/override-safety` | Q | Ghi đè cảnh báo `block`, body `reason` |
| GET | `bookings/{id}/history` | L T Q | `BookingStatusLog` |
| GET | `resources` | L T Q | Danh sách tài nguyên và tình trạng hiện tại |
| POST, PATCH | `resources`, `resources/{id}` | Q | Thêm/sửa/ẩn tài nguyên |
| GET | `resources/occupancy` | L T Q | Sơ đồ chiếm dụng theo `date`, `time` |

Walk-in (SPA-18, nên có):

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `walk-ins` | L Q | Hàng đợi hôm nay |
| POST | `walk-ins` | L; K (lấy số tại web nếu mở) | Lấy số, trả `queue_no`, `estimated_wait_minutes` |
| POST | `walk-ins/{id}/call` | L | `waiting → called` |
| POST | `walk-ins/{id}/convert` | L | Tạo `Booking` từ phiếu walk-in |
| POST | `walk-ins/{id}/leave` | L | `→ left` |

## 8.6 Hóa đơn và tổng quan (SPA-19, 20, 21, 22)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `invoices` | L Q; K chủ | Lọc `status`, `date_from`, `date_to` |
| GET | `invoices/{id}` | L Q; K chủ | Chi tiết kèm dòng; dữ liệu để frontend dựng bản in |
| POST | `invoices/{id}/pay` | L Q | Ghi đã thu, body `payment_method` |
| POST | `invoices/{id}/void` | Q | Hủy, body `reason` |
| GET | `dashboard/daily` | L Q | Doanh thu, số lịch theo trạng thái, chờ duyệt, hủy, feed (`date`) |
| GET | `notifications` | K L T Q | Của mình, lọc `is_read` |
| POST | `notifications/{id}/read` | K L T Q | Đánh dấu đã đọc |
| POST | `notifications/read-all` | K L T Q | Đọc hết |
| GET | `onboarding/checklist` | Q | Trạng thái từng mục khởi động (SPA-22, tùy chọn) |

## 8.7 AI (Pha 2)

Mọi endpoint `ai/*` ghi `AiLog`. Không endpoint nào tạo `Booking`.

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `ai/knowledge-docs` | Q | Danh sách tài liệu tri thức (SPA-24) |
| POST | `ai/knowledge-docs` | Q | Tải lên tài liệu (multipart), tách đoạn; trả JSON metadata |
| PATCH | `ai/knowledge-docs/{id}` | Q | Bật/tắt dùng tài liệu |
| DELETE | `ai/knowledge-docs/{id}` | Q | Gỡ tài liệu |
| POST | `ai/chat` | P (chế độ chung); K L T (kèm `pet_id` thì dùng hồ sơ thú) | Body: `session_id`, `message`, `pet_id` tùy chọn. Trả `answer`, `sources` |
| GET | `ai/chat/sessions/{session_id}` | Chủ phiên | Lịch sử một phiên |
| POST | `ai/suggestions/packages` | K chủ; L Q | Body `pet_id`. Trả 1–3 `AiSuggestion` kèm `reason_text`, `confidence`, `warnings` |
| POST | `ai/suggestions/staff` | L Q | Body `package_id`/`service_ids`, `start_at`. Trả danh sách thợ kèm lý do |
| GET | `ai/suggestions/{id}` | Người yêu cầu; Q | Chi tiết một gợi ý |
| POST | `ai/suggestions/{id}/accept` | Người yêu cầu | Đánh dấu `accepted` và trả **bản nháp** form đặt lịch (không tạo booking) |
| POST | `ai/suggestions/{id}/reject` | Người yêu cầu | `status = rejected` |
| POST | `ai/safety-check` | K chủ; L T Q | Body `pet_id`, `service_ids`/`package_id`. Trả cảnh báo `warn`/`block` |
| GET, POST, PATCH, DELETE | `contraindications` | GET: L T Q; ghi: Q | Ma trận dịch vụ–chống chỉ định (SPA-27) |
| GET, POST, PATCH, DELETE | `rebook-rules` | Q | Luật chu kỳ tái spa (SPA-28) |
| GET | `ai/rebook/due` | Q | Danh sách đến hạn đã xếp hạng (SPA-29) |
| POST | `ai/rebook/refresh` | Q | Chạy tính lại ngay; việc định kỳ dùng lệnh quản trị |
| POST | `ai/rebook/{id}/approve` | Q | Duyệt và gửi `Notification` cho khách |
| POST | `ai/rebook/{id}/dismiss` | Q | Bỏ qua |
| GET | `ai/rebook/mine` | K chủ | Nhắc của mình (nếu `allow_reminders`) |
| GET | `ai/logs` | Q | Nhật ký hỏi–đáp và gợi ý; lọc `kind`, `date_from`, `date_to` (SPA-31) |

## 8.8 Truy vết SPA → endpoint

| SPA | Endpoint |
|-----|----------|
| 01 | `spa` |
| 02, 03 | `auth/*` |
| 04, 05, 06 | `services*`, `packages*`, `size-bands` |
| 07 | `clients*` |
| 08 | `pets*`, `health-tags` |
| 09–12 | `bookings*` |
| 13, 14 | `staff*`, `specialties`, `bookings/{id}/assign-staff` |
| 15 | `bookings/{id}/check-in`, `check-out`, `start`, `complete` |
| 16, 17 | `resources*` |
| 18 | `walk-ins*` |
| 19 | `invoices*` |
| 20 | `dashboard/daily` |
| 21 | `notifications*` |
| 22 | `onboarding/checklist` |
| 23, 24 | `ai/chat`, `ai/knowledge-docs*` |
| 25, 26, 27 | `ai/suggestions/packages`, `ai/safety-check`, `contraindications` |
| 28, 29 | `ai/rebook/*`, `rebook-rules` |
| 30 | `ai/suggestions/staff` |
| 31 | `ai/logs` |
