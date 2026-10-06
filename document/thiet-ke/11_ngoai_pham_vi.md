# 11. Ngoài phạm vi

> **Lưu ý:** sheet `04_NgoaiPhamVi` bị thiếu trong `ChucNang_HeThong_SpaThuY_AI.xlsx` (tài liệu ghi 12 hạng mục). Danh sách dưới chỉ gồm 6 hạng mục do yêu cầu giao việc nêu rõ, cộng các mục suy trực tiếp từ `01_PhamVi` và phần đã chốt. **Chờ đối chiếu với sheet 04 khi nhóm cung cấp.**

## 11.1 Hạng mục ngoài phạm vi (không đưa vào use case)

| # | Hạng mục | Nguồn | Lý do loại |
|---|----------|-------|-----------|
| 1 | Đa chi nhánh / chuỗi cửa hàng | Giao việc; `01_PhamVi` #4 | Chỉ một cơ sở |
| 2 | Đặt lịch tại nhà | Giao việc; `01_PhamVi` #1 | Không làm ứng dụng dắt thú/đón thú tại nhà |
| 3 | GPS / định vị | Giao việc; `01_PhamVi` #3 | Không dùng dữ liệu định vị |
| 4 | Tuyến đường / điều phối tuyến / tài xế | Giao việc; `01_PhamVi` #2, #6 | Không tối ưu tuyến xe |
| 5 | Chiến dịch marketing / thư hàng loạt / quảng cáo | Giao việc; `01_PhamVi` kết luận | Tránh lệch đề |
| 6 | Website builder / trang mạng xã hội | Giao việc; `01_PhamVi` #5 | Không làm trình tạo website |
| 7 | Bảng lương | Giao việc | Ngoài quản lý spa |
| 8 | Nền tảng nhiều spa đăng ký: tenant, gói thuê bao, admin của hãng phần mềm | Phần đã chốt | Không phải SaaS |
| 9 | Định giá động kiểu sự kiện | `01_PhamVi` #6 | Ngoài đề tài |
| 10 | Dùng số liệu thị trường làm dữ liệu vận hành | `01_PhamVi` #3 | Chỉ dùng viết bối cảnh |
| 11 | Thực tập sinh nhiều cấp duyệt | `01_PhamVi` #2 | Chỉ bốn vai trò người |

## 11.2 Việc AI cố ý không làm

- Chẩn đoán bệnh, kê thuốc, hướng dẫn điều trị.
- Tự đặt lịch, tự hủy lịch, tự gửi nhắc, tự tạo hóa đơn.
- Đọc hoặc gửi ra ngoài tên chủ, SĐT, email, địa chỉ.
- Trả lời khi không có nguồn (tài liệu spa hoặc hồ sơ thú).

## 11.3 Những thứ khác bị loại khỏi Pha 1–2

| Hạng mục | Lý do |
|----------|-------|
| SMS, Zalo OA, email tự động | Nhắc chỉ qua thông báo trong ứng dụng |
| Cổng thanh toán trực tuyến (VNPay, Momo) | Thu tại chỗ: tiền mặt hoặc chuyển khoản ghi nhận tay (`SPA-19`: "chưa cần cổng thanh toán quốc tế") |
| Ứng dụng di động riêng | Chỉ web React |
| Vector DB, microservice, API Gateway | Theo `DeXuat` nhưng không phù hợp stack đã chốt; xem [07_kien_truc.md](07_kien_truc.md) |
| Huấn luyện hoặc tinh chỉnh mô hình | AI dùng luật + truy xuất tài liệu; không tự huấn luyện |
| Chat chữ nhân viên–khách | Pha 3 (`SPA-37`) |

## 11.4 Pha 3: giai đoạn sau

Ghi nhận để không phải thiết kế lại, **không có use case, API, màn hình trong bộ này**:

| SPA | Nội dung |
|-----|----------|
| 32, 33 | Kho vật tư, định mức, tự trừ kho |
| 34, 35, 36 | Phiếu chăm sóc, ảnh trước–sau, checklist ca |
| 37 | Chat chữ |
| 38 | Luật nhắc 24 giờ, cảnh báo hết hàng |
| 39 | Phân tích tuần |
| 40 | Gửi hóa đơn qua email |
| 41 | Phiếu đồng ý, bản scan sổ tiêm |
| 42, 43, 44, 45, 46 | Phân nhóm khách, phụ thu, đánh giá, đặt cọc, khách quen |

Chỗ để lại sẵn khi thiết kế: `Service.supplies_note` (cho định mức), `Booking.status` và `BookingStatusLog` (cho checklist), `Notification` (cho luật nhắc), `Invoice.total/subtotal` (cho phụ thu, cọc).

## 11.5 Pha 4: chỉ làm nếu Pha 1–2 đóng sớm

| SPA | Nội dung | Ghi chú |
|-----|----------|---------|
| 47 | Soạn phiếu chăm sóc bằng AI | Phụ thuộc Pha 3 (phiếu, ảnh, checklist) |
| 48 | QR chuyển khoản trên hóa đơn | |
| 49 | Chặn check-in khi mũi tiêm bắt buộc quá hạn | Gần với `PetVaccination` đã có. Hiện chỉ cảnh báo vàng |

Không đưa Pha 4 vào use case chính. Không làm sát ngày nộp.

## 11.6 Hạn chế cần nói thật khi bảo vệ

- Dữ liệu là dữ liệu mẫu; chưa chạy trên spa thật.
- Một cơ sở, không đa chi nhánh.
- AI chỉ tham khảo; độ tin cậy là điểm luật, không phải xác suất.
- Gợi ý có thể sai với giống hiếm hoặc dữ liệu hồ sơ thiếu.
