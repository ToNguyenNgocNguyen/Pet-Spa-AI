# 02. Actor và phân quyền

## 2.1 Actor

| Actor | Loại | Vai trò trong hệ thống | Vai trò kỹ thuật (`User.role`) |
|-------|------|------------------------|--------------------------------|
| Khách hàng (chủ thú) | Người | Tự đăng ký, khai hồ sơ thú, đặt lịch, hỏi chatbot, xem hóa đơn và nhắc của mình | `customer` |
| Lễ tân | Người | Quầy: nhập khách/thú, nhận đặt lịch, duyệt lịch, check-in/out, lập hóa đơn, thu tiền | `receptionist` |
| Kỹ thuật viên | Người | Xem lịch được giao, đọc an toàn thú trước khi nhận, thực hiện dịch vụ, cập nhật trạng thái | `technician` |
| Quản lý / chủ spa | Người | Cấu hình spa, catalog, giá, nhân sự, tài nguyên; nạp tri thức AI; duyệt nhắc; xem báo cáo | `manager` |
| AI Agent | Hệ thống | Đọc hồ sơ thú + catalog + lịch sử + tài liệu cơ sở, rồi **đề xuất**. Không tự quyết | Không có tài khoản `User` |

Ghi chú theo Chương 3 (slide):
- `SPA-02` ghi "3 vai trò: Khách / Nhân viên / Quản lý". Nhóm tách "Nhân viên" thành Lễ tân và Kỹ thuật viên bằng quyền theo trang (đúng ghi chú của `SPA-02`), không dựng engine role phức tạp. Chỉ 4 giá trị role, mỗi tài khoản một role.
- **Khách vãng lai chưa đăng nhập** là một trạng thái của actor Khách hàng, không phải actor riêng. Được xem hồ sơ spa, danh mục, giá, và hỏi chatbot ở chế độ chung (không đọc hồ sơ thú). Đặt lịch bắt buộc đăng nhập.
- Khách đến quầy không có tài khoản vẫn có bản ghi `Client`; lễ tân nhập hộ. Khách này không phải actor (ví dụ slide: người nhờ nhân viên đặt lịch không là actor).

## 2.2 Ký hiệu ma trận

Bám `05_TheoNguoiDung`: **C** = chủ dữ liệu / cấu hình (tạo, sửa, xóa mềm); **R** = dùng chức năng trong phạm vi quyền của mình; **A** = có bước AI tham gia (use case AI `<<include>>`/`<<extend>>`, xem [04_use_case.md](04_use_case.md)); **—** = không được; **(\*)** = nhóm đề xuất vì ma trận gốc không có dòng.

## 2.3 Ma trận phân quyền Pha 1–2

| Mã | Chức năng | Khách | Lễ tân | KTV | Quản lý | AI |
|----|-----------|:-----:|:------:|:---:|:-------:|:--:|
| SPA-01 | Hồ sơ cơ sở spa | R(\*) | R(\*) | R(\*) | C | — |
| SPA-02 | Đăng nhập / vai trò | R | R | R | C | — |
| SPA-03 | Tài khoản cá nhân | R(\*) | R(\*) | R(\*) | R(\*) | — |
| SPA-04 | Danh mục dịch vụ | R | R | R | C | A |
| SPA-05 | Gói combo | R | R | R | C | A |
| SPA-06 | Giá theo size | R | R | — | C | A |
| SPA-07 | Hồ sơ khách | R | C | — | C | — |
| SPA-08 | Hồ sơ thú + dị ứng + tiêm | C | R, C(\*) | R, C(\*) | R | A |
| SPA-09 | Đặt / sửa / hủy lịch | R | R | — | R | — |
| SPA-10 | Duyệt lịch | R | R | — | R | — |
| SPA-11, 12 | Danh sách, chi tiết lịch | R(\*) | R(\*) | R | R(\*) | — |
| SPA-13 | Team + giờ làm | — | — | C | C | — |
| SPA-14 | Gán kỹ thuật viên | — | R | R | C | A |
| SPA-15 | Check-in / check-out | — | R | R | R | — |
| SPA-16, 17 | Công suất, sơ đồ tài nguyên | — | R | R | C | — |
| SPA-18 | Hàng đợi walk-in (nên có) | R | R | — | R | — |
| SPA-19 | Hóa đơn + thanh toán | R | R | — | R | — |
| SPA-20 | Dashboard ngày | — | R | — | R | — |
| SPA-21 | Thông báo (nên có) | R(\*) | R(\*) | R(\*) | R(\*) | — |
| SPA-23 | Chatbot tư vấn | R | R(\*) | R | — | A |
| SPA-24 | Nạp tri thức AI | — | — | — | C | A |
| SPA-25, 26 | Gợi ý gói + lý do | R | R | — | R | A |
| SPA-27 | Cảnh báo chống chỉ định | R | R | R | R | A |
| SPA-28 | Nhắc tái spa | R | — | — | R | A |
| SPA-29 | Danh sách đến hạn (nên có) | — | — | — | C(\*) | A |
| SPA-30 | Gợi ý thợ (nên có) | — | R | — | R | A |
| SPA-31 | Nhật ký AI (nên có) | — | — | — | R(\*) | — |

Ghi chú:
- `SPA-23`: ma trận gốc chỉ đánh KTV trong nhóm nhân viên, nhưng `02_ChucNang` ghi "Khách hàng, Nhân viên". Nhóm cho cả Lễ tân dùng (đánh dấu \*). Quản lý xem lại qua nhật ký (SPA-31).
- `SPA-08` cột Lễ tân/KTV: `02_ChucNang` ghi "Khách khai + nhân viên bổ sung sau lần đến". Nhóm cho nhân viên cập nhật cân nặng, tiêm phòng (Lễ tân) và ghi chú/dị ứng/cờ an toàn sau ca (KTV).
- Khách chỉ **R** trên `SPA-09/10/19` nghĩa là dùng trong dữ liệu của chính mình.

## 2.4 Mỗi actor được và không được làm

### Khách hàng
**Được:** đăng ký/đăng nhập; sửa tài khoản mình; thêm/sửa thú của mình (giống, tuổi, cân nặng, dị ứng, tiêm phòng); xem catalog, gói, giá; đặt lịch (trạng thái ban đầu `pending`); sửa/hủy lịch của mình khi chưa `checked_in` và trước giờ hẹn tối thiểu `Spa.cancel_cutoff_hours`; xem hóa đơn của mình; hỏi chatbot; xin gợi ý gói cho thú của mình; bấm chấp nhận gợi ý để điền vào form đặt lịch; xem và tắt nhắc tái spa.
**Không được:** xem dữ liệu khách/thú/lịch của người khác; xem ghi chú nội bộ; duyệt lịch; đổi giá; xem doanh thu, nhật ký AI; sửa hóa đơn.

### Lễ tân
**Được:** tạo/sửa hồ sơ khách và thú (khách đến quầy); đặt lịch hộ; duyệt/từ chối lịch kèm lý do; sửa/hủy lịch; gán kỹ thuật viên (có gợi ý); check-in/check-out; chọn tài nguyên khi nhận thú; lập hóa đơn, ghi đã thu (tiền mặt/chuyển khoản); quản lý hàng đợi walk-in; xem dashboard ngày; xin gợi ý gói cho khách tại quầy; xem cảnh báo chống chỉ định.
**Không được:** sửa catalog, giá, ma trận chống chỉ định; quản lý tài khoản nhân viên; cấu hình tài nguyên và công suất; nạp tri thức AI; duyệt nhắc tái spa; xem nhật ký AI; hủy hóa đơn đã thu; **vượt cảnh báo chặn** (chỉ quản lý được).

### Kỹ thuật viên
**Được:** xem lịch được giao và bảng ca trong ngày (chỉ đọc); mở chi tiết lịch trước khi nhận thú (dị ứng, cờ an toàn, ghi chú); chuyển `checked_in → in_progress → completed` cho lịch **được giao cho mình**; ghi chú tình trạng da/lông, dị ứng, cờ an toàn lên hồ sơ thú sau ca; khai giờ rảnh, xin nghỉ; hỏi chatbot.
**Không được:** tạo/hủy/duyệt lịch; xem hóa đơn, doanh thu, dashboard; sửa giá; xem lịch của thợ khác ở chế độ chỉnh sửa; xem thông tin liên hệ của khách ngoài tên và ghi chú an toàn.

### Quản lý
**Được:** toàn bộ quyền của lễ tân; cấu hình hồ sơ spa, catalog, gói, giá theo size, tài nguyên, giờ làm, chuyên môn; mời/khóa tài khoản nhân viên; **ghi đè cảnh báo chặn** (bắt buộc ghi lý do); hủy hóa đơn; nạp/gỡ tài liệu tri thức; cấu hình ma trận chống chỉ định và luật chu kỳ tái spa; duyệt danh sách đến hạn rồi gửi nhắc; xem nhật ký AI; xem dashboard.
**Không được:** xóa cứng bản ghi đã có lịch sử (chỉ vô hiệu hóa `is_active=false`); sửa nhật ký AI; giả danh khách khi đặt lịch mà không qua luồng hộ khách.

### AI Agent
**Được:** đọc hồ sơ thú (giống, loài, tuổi, cân nặng, da lông, thẻ sức khỏe, tiêm phòng), lịch sử lịch hoàn tất, catalog + giá, ma trận chống chỉ định, lịch rảnh và chuyên môn nhân viên, đoạn tài liệu tri thức; **ghi** `AiSuggestion`, `AiLog`, và `RebookReminder` ở trạng thái `suggested`.
**Không được:**
- Tạo/sửa/hủy `Booking`, `Invoice`, `Pet`, `Client`, `User` (chỉ người thao tác).
- Gửi nhắc cho khách khi chưa có quản lý duyệt.
- Chẩn đoán bệnh, kê thuốc. Câu hỏi y khoa trả lời theo tài liệu spa kèm nhắc "hãy đưa thú đến bác sĩ thú y".
- Đọc số điện thoại, email, địa chỉ của khách. Ngữ cảnh gửi cho mô hình chỉ gồm dữ liệu thú và catalog.
- Trả lời không có lý do và nguồn.

## 2.5 Quy tắc thực thi

1. Phân quyền kiểm tra **ở backend** (DRF permission + lọc queryset theo chủ sở hữu). Ẩn menu ở frontend chỉ để tiện dùng, không phải biện pháp bảo mật.
2. Mọi API trả về chỉ dữ liệu trong phạm vi quyền: khách lọc theo `Client.user = request.user`; kỹ thuật viên lọc theo `Booking.staff = họ`.
3. Mọi hành động đổi trạng thái lịch ghi `BookingStatusLog` (ai, lúc nào, từ → đến, lý do).
4. Ghi đè cảnh báo chặn chỉ do `manager`, ghi lý do và vào `AiLog`.
