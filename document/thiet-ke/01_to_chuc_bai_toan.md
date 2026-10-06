# 01. Tổ chức và bài toán

> Tên spa, địa chỉ, số liệu nhân sự dưới đây là **giả định** để làm hồ sơ SPA-01. Nhóm có thể đổi mà không ảnh hưởng thiết kế.

## 1.1 Tổ chức

| Mục | Nội dung |
|-----|----------|
| Sản phẩm | Pet Spa AI |
| Cơ sở triển khai | **Spa Thú Y Lông Mượt** (tên giả định), một cơ sở duy nhất |
| Địa chỉ (giả định) | 25 Lê Văn Thịnh, P. Bình Trưng Tây, TP. Thủ Đức, TP.HCM |
| Giờ mở cửa | 08:00–19:00, thứ Hai đến Chủ nhật |
| Nhân sự | 1 quản lý (chủ spa), 1 lễ tân, 5 kỹ thuật viên. Dữ liệu mẫu demo nạp 3 kỹ thuật viên (tắm / cắt Poodle / spa mèo) |
| Tài nguyên vật lý | 2 bồn tắm, 3 bàn cắt tỉa, 4 chuồng sấy, 1 phòng spa mèo |
| Khách mục tiêu | Chủ chó mèo trong khu vực; khoảng 15–25 lượt/ngày |
| Dịch vụ | Tắm, cắt tỉa, vệ sinh tai, spa dưỡng; gói combo (ví dụ Gói VIP) |

## 1.2 Quy trình hiện tại và chỗ hỏng

Suy từ `01_PhamVi` ("đang nằm trên tin nhắn và sổ tay") và cột "Điểm tối ưu" ở `02_ChucNang`. **Chưa phỏng vấn thật**, cần nhóm xác nhận.

| Bước | Làm hiện nay | Chỗ hỏng | Hệ thống mới xử lý bằng |
|------|--------------|----------|--------------------------|
| Báo giá | Nhắn tin, báo miệng | Giá không thống nhất, tranh cãi tại quầy | Bảng giá theo size XS–XL (SPA-04/05/06) |
| Đặt lịch | Tin nhắn, ghi sổ tay | Trùng lịch, quên slot, vượt số bàn/chuồng sấy | Chặn trùng và quá tải (SPA-09, 16, 17) |
| Hồ sơ thú | Sổ giấy, nhớ trong đầu | Mất dữ liệu; thợ không biết thú dị ứng, hay cắn, chưa tiêm | Hồ sơ thú có dị ứng, tiêm phòng, cờ an toàn (SPA-08) |
| Chọn gói | Lễ tân tư vấn theo kinh nghiệm | Không nhất quán; có thể chọn nhầm hóa chất cho da nhạy | AI gợi ý gói kèm lý do và cảnh báo (SPA-25–27) |
| Giao việc | Quản lý gán miệng | Giao nhầm thợ cắt | Phân công theo chuyên môn và giờ rảnh (SPA-14, 30) |
| Trong ngày | Nhớ thú nào đang ở trong | Sót trả thú, không rõ chỗ trống | Bảng lễ tân, sơ đồ tài nguyên (SPA-15, 17) |
| Thu tiền | Tính tay, đối soát cuối ngày | Sai lệch doanh thu | Hóa đơn sinh từ lịch, dashboard khớp (SPA-19, 20) |
| Giữ khách | Tự nhớ để nhắn lại | Khách rơi sau lần cắt đầu | Nhắc tái spa theo chu kỳ lông (SPA-28, 29) |
| Hỏi đáp ngoài giờ | Trả lời tin nhắn thủ công | Chậm, trả lời không thống nhất | Chatbot bám SOP và bảng giá của spa (SPA-23, 24) |

## 1.3 Hệ thống mới dùng ở đâu

- **Ở quầy:** lễ tân và kỹ thuật viên dùng màn hình ca trong giờ làm (bảng lễ tân, lịch, chi tiết lịch, check-in/out, hóa đơn). Dùng trên máy tính để bàn hoặc máy tính bảng tại quầy.
- **Trên web đặt lịch:** khách đăng ký tài khoản, khai hồ sơ thú, xem giá, đặt lịch, hỏi chatbot, xem nhắc tái spa.
- **Quản lý:** dashboard ngày, cấu hình catalog/giá/nhân sự/tài nguyên, nạp tri thức AI, duyệt nhắc tái spa.
- **AI** nằm giữa các bước trên: tư vấn, gợi ý gói kèm lý do, cảnh báo chống chỉ định, nhắc tái spa, gợi ý thợ. **Người luôn xác nhận.**

## 1.4 Mục tiêu và định nghĩa xong

- Pha 1 chạy được một vòng đời thú: đặt lịch → nhận thú → làm dịch vụ → thu tiền.
- Pha 2 tích hợp AI trên chính dữ liệu của Pha 1.
- Một chức năng "xong" khi có use case, có trường dữ liệu, có màn hình hoặc API chạy được, và có người thực hiện được một vòng (theo `00_TomTat`). Nút trống không tính.
- Ba ràng buộc dự án (Chương 2): **Phạm vi** = Pha 1–2 bắt buộc; **Thời gian** = 12 tuần, trễ thì cắt Pha 3; **Chi phí** = gần như chỉ tiền gọi API LLM.

## 1.5 Phạm vi một dòng

Hệ thống thông tin quản lý **một** spa thú y tại chỗ, bốn vai trò người cộng AI Agent. Không tenant, không gói thuê bao, không admin của hãng phần mềm. Chi tiết loại trừ xem [11_ngoai_pham_vi.md](11_ngoai_pham_vi.md).
