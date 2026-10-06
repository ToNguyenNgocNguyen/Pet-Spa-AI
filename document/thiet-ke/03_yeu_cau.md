# 03. Yêu cầu

Phạm vi: Pha 1 và Pha 2. Nhãn: **[BB]** bắt buộc, **[NC]** nên có, **[TC]** tùy chọn. Pha 3 và Pha 4 không có trong bảng, xem [11_ngoai_pham_vi.md](11_ngoai_pham_vi.md).

## 3.1 Yêu cầu chức năng theo use case

Mã `FR-xx` dùng để truy vết. Use case xem [04_use_case.md](04_use_case.md).

### Nền tảng (Pha 1)

| Mã | Yêu cầu | UC | SPA |
|----|---------|----|-----|
| FR-01 | Hệ thống lưu một bản ghi hồ sơ spa (tên, SĐT, địa chỉ, logo, giờ mở cửa); chỉ tồn tại một bản ghi. [BB] | UC-01 | 01 |
| FR-02 | Đăng nhập bằng tên đăng nhập và mật khẩu; có bốn vai trò; menu và API chỉ hiện chức năng đúng vai trò. [BB] | UC-02 | 02 |
| FR-03 | Khách tự đăng ký tài khoản; quản lý mời/khóa tài khoản nhân viên và gán vai trò. [BB] | UC-03, 04 | 02 |
| FR-04 | Người dùng đổi mật khẩu, cập nhật liên hệ, bật/tắt nhận nhắc. [NC] | UC-05 | 03 |
| FR-05 | Quản lý khai dịch vụ: tên, mô tả, thời lượng, loài áp dụng, loại tài nguyên cần, chuyên môn cần, vật tư gợi ý (ghi chú). [BB] | UC-06 | 04 |
| FR-06 | Quản lý khai gói combo gồm nhiều dịch vụ theo thứ tự và giá gói. [BB] | UC-07 | 05 |
| FR-07 | Giá dịch vụ và gói tính theo size XS–XL, size suy ra từ cân nặng và loài của thú theo bảng `SizeBand`. [BB] | UC-08 | 06 |
| FR-08 | Mọi actor xem được danh mục dịch vụ, gói, giá; khách chưa đăng nhập cũng xem được. [BB] | UC-09 | 04–06 |
| FR-09 | Thêm/sửa/ẩn/tìm khách hàng; mọi lịch và hóa đơn gắn vào một khách. [BB] | UC-10 | 07 |
| FR-10 | Hồ sơ thú gồm: loài, giống, loại lông, ngày sinh, cân nặng, thẻ sức khỏe (dị ứng, bệnh da, hành vi), lịch sử tiêm phòng. **Bắt buộc có dị ứng (có thể "không") và ngày tiêm.** [BB] | UC-11 | 08 |
| FR-11 | Đặt lịch: chọn thú, gói hoặc dịch vụ lẻ, khung giờ, tùy chọn kỹ thuật viên; hệ thống tính giá theo size. [BB] | UC-12 | 09 |
| FR-12 | Hệ thống **chặn** đặt trùng khi: (a) vượt số tài nguyên cùng loại đang trống trong khung giờ; (b) kỹ thuật viên đã có lịch trùng; (c) thú đã có lịch trùng; (d) ngoài giờ mở cửa hoặc ngày nghỉ của kỹ thuật viên. [BB] | UC-12 | 09, 16 |
| FR-13 | Sửa/hủy lịch theo máy trạng thái ở [05_quy_trinh.md](05_quy_trinh.md); mỗi lần đổi trạng thái lưu lịch sử và lý do. [BB] | UC-13 | 09 |
| FR-14 | Lễ tân/quản lý xác nhận hoặc từ chối lịch `pending`; từ chối bắt buộc nhập lý do (hết slot, thú chưa tiêm...). [BB] | UC-14 | 10 |
| FR-15 | Xem lịch dạng tháng, ngày, danh sách có lọc theo trạng thái, dịch vụ, ngày, tìm theo khách/thú. [BB] | UC-15 | 09, 11 |
| FR-16 | Chi tiết lịch hiển thị thú, dịch vụ, ghi chú nội bộ, huy hiệu an toàn (dị ứng, cắn, chưa tiêm) và hóa đơn. [BB] | UC-16 | 12 |
| FR-17 | Quản lý khai nhân viên, chuyên môn, giờ làm theo tuần, ngày nghỉ; nhân viên tự cập nhật giờ rảnh và xin nghỉ. [BB] | UC-17 | 13 |
| FR-18 | Gán kỹ thuật viên cho lịch; hệ thống chỉ ra người rảnh và đúng chuyên môn, quản lý vẫn gán tay được. [BB] | UC-18 | 14 |
| FR-19 | Check-in ghi thời điểm nhận thú và gán tài nguyên cụ thể (bàn/chuồng); check-out ghi thời điểm trả thú. [BB] | UC-19, 21 | 15, 17 |
| FR-20 | Kỹ thuật viên chuyển trạng thái `in_progress`, `completed` cho lịch của mình. [BB] | UC-20 | 12, 15 |
| FR-21 | Quản lý khai danh mục tài nguyên (bồn, bàn cắt, chuồng sấy, phòng spa) và trạng thái hoạt động; số tài nguyên hoạt động từng loại là công suất song song tối đa. [BB] | UC-22 | 16, 17 |
| FR-22 | Walk-in: lấy số thứ tự, ước thời gian chờ theo slot trống và thời lượng dịch vụ. [NC] | UC-23 | 18 |
| FR-23 | Hóa đơn tự sinh khi lịch `completed`: dòng theo gói/dịch vụ với giá theo size; trạng thái `unpaid`/`paid`/`void`; ghi phương thức tiền mặt hoặc chuyển khoản. [BB] | UC-24 | 19 |
| FR-24 | Xem và in hóa đơn (xuất PDF qua chức năng in của trình duyệt). [BB] | UC-25 | 19 |
| FR-25 | Dashboard ngày: doanh thu (tổng hóa đơn `paid`), số lịch theo trạng thái, chờ duyệt, hủy, feed hôm nay. Doanh thu một ngày khớp tổng hóa đơn. [BB] | UC-26 | 20 |
| FR-26 | Thông báo trong ứng dụng: lịch mới, sắp đến giờ, thanh toán. [NC] | UC-27 | 21 |
| FR-27 | Checklist khởi động cho quản lý (dịch vụ, thú, nhân viên, nạp AI, lịch đầu). [TC] | UC-28 | 22 |

### AI (Pha 2)

| Mã | Yêu cầu | UC | SPA |
|----|---------|----|-----|
| FR-30 | Quản lý tải lên đúng các tài liệu cơ sở (SOP nhận thú, chống chỉ định hóa chất, bảng giá/dịch vụ); hệ thống tách đoạn và lưu để truy xuất. Quản lý xem được tài liệu AI đang dùng. [BB] | UC-29 | 24 |
| FR-31 | Chatbot trả lời câu hỏi chăm sóc thú **dựa trên tài liệu cơ sở**, có kèm trích nguồn; nếu đã đăng nhập và chọn thú, dùng thêm hồ sơ thú. Ngoài tài liệu thì nói không có thông tin, không bịa. [BB] | UC-30 | 23 |
| FR-32 | Gợi ý 1–3 gói cho một thú theo giống, tuổi, loại lông, tình trạng sức khỏe, lịch sử dịch vụ; lưu `AiSuggestion` có độ tin cậy. [BB] | UC-31 | 25 |
| FR-33 | **Mỗi gợi ý kèm lý do đọc được** và các dữ kiện đã dùng. [BB] | UC-32 | 26 |
| FR-34 | Cảnh báo chống chỉ định: thú có thẻ sức khỏe trùng ma trận dịch vụ–chống chỉ định thì cảnh báo vàng (`warn`) hoặc chặn đỏ (`block`). Chạy khi gợi ý, khi đặt lịch, và hiện trên chi tiết lịch/check-in. Do luật xác định, không do mô hình ngôn ngữ. [BB] | UC-33 | 27 |
| FR-35 | Người xác nhận mới đưa gợi ý vào lịch: chấp nhận gợi ý chỉ điền sẵn form đặt lịch; tạo `Booking` qua luồng đặt lịch thường. AI không tự đặt. [BB] | UC-34 | 25 |
| FR-36 | Hệ thống tính danh sách thú đến hạn tái spa theo luật chu kỳ giống/loại lông/gói đã dùng; tạo một nhắc cho mỗi lần dịch vụ; khách có thể tắt. [BB] | UC-35 | 28 |
| FR-37 | Quản lý xem danh sách đến hạn đã xếp hạng, duyệt rồi mới gửi nhắc (thông báo trong ứng dụng). [NC] | UC-36 | 29 |
| FR-38 | Gợi ý kỹ thuật viên rảnh, đúng chuyên môn, ít tải trong ngày, kèm lý do. [NC] | UC-37 | 30 |
| FR-39 | Quản lý xem nhật ký hỏi–đáp AI và các gợi ý đã đưa kèm trạng thái chấp nhận/từ chối. [NC] | UC-38 | 31 |
| FR-40 | Quản lý khai ma trận dịch vụ–chống chỉ định và danh mục thẻ sức khỏe. [BB] | UC-39 | 27 |
| FR-41 | Quản lý khai luật chu kỳ tái spa theo gói, loại lông. [BB] | UC-40 | 28 |

## 3.2 Yêu cầu phi chức năng (vừa đủ cho demo)

| Mã | Nhóm | Yêu cầu | Cách kiểm |
|----|------|---------|-----------|
| NFR-01 | Ngôn ngữ | Toàn bộ giao diện và báo cáo bằng tiếng Việt: nhãn, thông báo lỗi, ngày `dd/MM/yyyy`, tiền `1.250.000 ₫`. Ant Design dùng locale `vi_VN`. Tên model, API, biến, nhánh Git bằng tiếng Anh. | Duyệt màn hình theo danh sách ở [09_man_hinh.md](09_man_hinh.md) |
| NFR-02 | Bảo mật | Phân quyền bốn vai trò kiểm ở backend; khách chỉ thấy dữ liệu của mình; mật khẩu băm. Gọi API sai quyền trả 403. | Kịch bản đăng nhập lần lượt bốn vai trò; thử gọi API chéo quyền |
| NFR-03 | AI nêu lý do | Mọi gợi ý, cảnh báo, câu trả lời có lý do hoặc nguồn đọc được. Không có lý do thì không hiển thị. | Kiểm trường `reason_text` không rỗng; chatbot trả kèm nguồn |
| NFR-04 | AI không tự quyết | AI chỉ ghi `AiSuggestion`, `AiLog`, `RebookReminder`; không có đường ghi vào `Booking`/`Invoice`. Nhắc chỉ gửi sau khi quản lý duyệt. | Rà soát quyền ghi của lớp AI; test không có booking nào do AI tạo |
| NFR-05 | AI an toàn | AI không chẩn bệnh; mọi màn hình AI có câu "Gợi ý chỉ mang tính tham khảo". Cảnh báo chống chỉ định xác định bằng luật, không phụ thuộc mô hình ngôn ngữ. | Kịch bản demo mục 10 |
| NFR-06 | Truy vết AI | Mọi lần gọi AI lưu `AiLog` (đầu vào, đầu ra, nguồn, thời gian). | Màn hình nhật ký AI |
| NFR-07 | Riêng tư | Dữ liệu gửi sang nhà cung cấp LLM không chứa tên chủ, SĐT, email, địa chỉ. | Rà soát hàm dựng ngữ cảnh |
| NFR-08 | Tính đúng | Không để lịch trùng khi hai người đặt cùng lúc: kiểm tra trong một giao dịch cơ sở dữ liệu. Máy trạng thái lịch đóng, không có trạng thái treo. | Test đặt song song; test chuyển trạng thái sai bị từ chối |
| NFR-09 | Hiệu năng demo | Thao tác thường < 2 giây với dữ liệu mẫu (15 lịch, 12 thú); thao tác AI < 15 giây và có trạng thái đang xử lý. Nếu AI lỗi hoặc quá thời gian, hệ thống vẫn dùng được bình thường. | Đo thủ công khi demo |
| NFR-10 | Di chuyển CSDL | Làm việc trên SQLite; không dùng SQL thô riêng SQLite; tiền dùng `DecimalField`; thời gian có múi giờ `Asia/Ho_Chi_Minh`; ràng buộc khai báo bằng Django. Chuyển PostgreSQL lúc bảo vệ chỉ đổi cấu hình `DATABASES` và chạy lại migrate/seed. | Chạy bộ test trên cả hai CSDL trước bảo vệ |
| NFR-11 | Dữ liệu mẫu | Có lệnh nạp dữ liệu mẫu theo `06_KichBanDemo`: 1 spa, 1 quản lý, 1 lễ tân, 3 KTV, 10 khách, 12 thú (1 Poodle dị ứng hương liệu, 1 mèo chưa tiêm), 8 dịch vụ, 3 gói, 15 lịch trong 2 tuần, 6 hóa đơn, 1 SOP, 1 bảng giá. | Chạy lệnh nạp rồi chạy kịch bản demo |
| NFR-12 | Trình duyệt | Chạy trên Chrome/Edge bản mới, màn hình từ 1280 px; màn hình khách dùng được trên điện thoại. | Kiểm tay |
| NFR-13 | Sao lưu | Sao lưu bằng sao chép tệp SQLite và thư mục tài liệu tri thức. | Ghi trong tài liệu vận hành |
