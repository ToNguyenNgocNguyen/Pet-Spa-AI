# 09. Màn hình

Giao diện React + Ant Design, nhãn tiếng Việt, locale `vi_VN`. Mỗi màn hình ghi actor, việc chính, component Ant Design dự kiến, mã SPA. Không dùng HTML/CSS thuần cho màn hình chính.

Bố cục chung: `Layout` + `Sider` (menu theo vai trò) + `Header` (chuông thông báo `Badge` + `Dropdown` tài khoản) + `Content`. Lỗi API hiện bằng `message.error`/`Alert` với `detail` tiếng Việt.

## 9.1 Menu theo vai trò

| Vai trò | Mục menu |
|---------|----------|
| Khách hàng | Trang chủ · Đặt lịch · Lịch của tôi · Thú cưng của tôi · Hóa đơn · Nhắc tái spa · Hỏi trợ lý · Tài khoản |
| Lễ tân | Bảng lễ tân · Lịch hẹn · Chờ duyệt · Khách hàng · Thú cưng · Hàng đợi · Hóa đơn · Dashboard · Hỏi trợ lý · Tài khoản |
| Kỹ thuật viên | Lịch của tôi · Bảng ca hôm nay · Giờ làm · Hỏi trợ lý · Tài khoản |
| Quản lý | Dashboard · Lịch hẹn · Chờ duyệt · Khách hàng · Thú cưng · Hóa đơn · Dịch vụ & Giá · Nhân sự · Tài nguyên · Hồ sơ spa · **Trí tuệ nhân tạo** (Kho tri thức, Luật & chống chỉ định, Đến hạn tái spa, Nhật ký) · Tài khoản |

## 9.2 Màn hình Pha 1

| Mã | Màn hình (nhãn) | Actor | Việc chính | Component Ant Design | SPA |
|----|-----------------|-------|-----------|----------------------|-----|
| M01 | Đăng nhập / Đăng ký | P | Đăng nhập; khách đăng ký | `Tabs`, `Form`, `Input`, `Input.Password`, `Button`, `Alert` | 02 |
| M02 | Trang chủ | K, P | Xem thông tin spa, giờ mở cửa, gói nổi bật; nút đặt lịch | `Descriptions`, `Image`, `Card`, `Row/Col`, `Button` | 01, 04, 05 |
| M03 | Dashboard ngày | Q, L | Doanh thu, số lịch theo trạng thái, chờ duyệt, hủy, feed hôm nay, lịch cần xử lý quá hạn | `Statistic`, `Card`, `DatePicker`, `List`, `Timeline`, `Table`, `Badge`, `Alert` | 20 |
| M04 | Lịch hẹn: tháng / ngày | L, Q, T | Xem lịch; chế độ ngày là lưới giờ × kỹ thuật viên; bấm mở chi tiết | `Segmented`, `Calendar`, `Table` (lưới giờ), `Tag`, `Drawer`, `Select` | 09 |
| M05 | Danh sách lịch hẹn | L, Q, T | Lọc trạng thái, dịch vụ, ngày; tìm theo khách/thú | `Table`, `Input.Search`, `Select`, `DatePicker.RangePicker`, `Tag`, `Pagination` | 11 |
| M06 | Chi tiết lịch hẹn | T, L, Q | Thú, dịch vụ, ghi chú nội bộ, huy hiệu an toàn, lịch sử trạng thái, nút đổi trạng thái theo quyền, hóa đơn | `Descriptions`, `Steps`, `Alert` (đỏ/vàng), `Tag`, `Timeline`, `Button`, `Popconfirm`, `Modal`, `Select` (gán thợ) | 12, 14, 27 |
| M07 | Đặt lịch hẹn (khách / quầy) | K, L | Chọn thú → gói/dịch vụ → ngày giờ → kỹ thuật viên → xác nhận; hiện giá theo size và cảnh báo trước khi đặt | `Steps`, `Select`, `Radio.Group` (thẻ gói), `DatePicker`, `Segmented` (slot), `Alert`, `Descriptions`, `Checkbox` (đã đọc cảnh báo), `Result` | 09, 16, 06 |
| M08 | Chờ duyệt | L, Q | Duyệt hoặc từ chối kèm lý do | `Table`, `Button`, `Modal` + `Form` + `Input.TextArea`, `Tag` | 10 |
| M09 | Bảng lễ tân | L (T xem) | Cột Sắp đến / Đang ở trong nhà / Chờ trả; check-in chọn bàn/chuồng; check-out mở hóa đơn | `Row/Col`, `Card`, `List`, `Badge`, `Button`, `Modal`, `Select`, `Statistic` | 15, 17 |
| M10 | Tài nguyên | Q (L T xem) | Sơ đồ bàn/chuồng/bồn, trạng thái chiếm dụng; Q thêm/sửa/ẩn; thấy công suất từng loại | `Card` lưới, `Tag`, `Badge`, `Modal`, `Form`, `Switch`, `Select` | 16, 17 |
| M11 | Hàng đợi walk-in | L | Lấy số, ước thời gian chờ, gọi, đổi thành lịch | `Table`, `Statistic`, `Button`, `Modal`, `Form`, `Tag` | 18 [NC] |
| M12 | Hóa đơn & Thu ngân | L, Q, K | Xem, lập hóa đơn mới (+ Thêm hóa đơn từ lịch hoàn tất hoặc walk-in tại quầy), ghi nhận thanh toán, hủy (Q), in/Lưu PDF; liên kết ngược Lịch hẹn / Khách hàng / Thú cưng | `Table`, `Tag`, `RangePicker`, `Descriptions`, `Radio.Group`, `Modal`, `Button`, `Select`, `Badge` | 19 |
| M13 | Khách hàng | L, Q | Thêm/sửa/tìm, hiển thị danh sách thú cưng sở hữu của khách, nút thêm thú cưng nhanh, xem hồ sơ thú cưng, liên kết nhanh sang Lịch hẹn và Hóa đơn của khách | `Table`, `Input.Search`, `Drawer`, `Form`, `Tabs`, `Tag`, `Button`, `Tooltip` | 07 |
| M14 | Hồ sơ thú | K, L, T, Q | Khai giống, loại lông, ngày sinh, cân nặng, thẻ sức khỏe, dị ứng, tiêm phòng, ghi chú an toàn; xem size suy ra; cột chủ nuôi liên kết sang hồ sơ khách; nút Đặt lịch & AI Gợi ý gói trực tiếp | `Table`, `Form`, `Select mode="multiple"`, `InputNumber`, `DatePicker`, `Tag`, `List`, `Modal`, `Alert` (thiếu tiêm/dị ứng), `Button` | 08 |
| M15 | Dịch vụ & Giá | Q (K L T xem) | Danh mục dịch vụ, gói combo, bảng giá XS–XL; tính năng "+ Thêm dịch vụ mới" và "+ Thêm gói combo" (chọn dịch vụ thành phần & cấu hình giá size); nút "Đặt lịch ngay" | `Tabs`, `Table`, `Form`, `Input`, `InputNumber`, `Modal`, `Switch`, `Select`, `Button` | 04, 05, 06 |
| M16 | Nhân sự | Q | Danh sách, mời, chuyên môn, khóa tài khoản | `Table`, `Modal`, `Form`, `Select mode="multiple"`, `Switch` | 02, 13 |
| M17 | Giờ làm và ngày nghỉ | Q, T | Khai giờ làm theo tuần, xin nghỉ | `Table`, `TimePicker.RangePicker`, `RangePicker`, `Form`, `Calendar` | 13 |
| M18 | Hồ sơ spa | Q | Sửa tên, SĐT, địa chỉ, logo, giờ mở cửa, quy định hủy | `Form`, `Upload`, `TimePicker`, `InputNumber`, `Checkbox.Group` | 01 |
| M19 | Tài khoản của tôi | K L T Q | Đổi mật khẩu, thông tin liên hệ, bật/tắt nhận nhắc | `Form`, `Input.Password`, `Switch`, `Card` | 03 |
| M20 | Thông báo | K L T Q | Xem và đánh dấu đã đọc | `Badge`, `Popover`/`Dropdown`, `List`, `Button` | 21 |
| M21 | Khởi động nhanh | Q | Checklist: dịch vụ, thú, nhân viên, nạp AI, lịch đầu | `Steps`, `Checkbox`, `Progress`, `Button` | 22 [TC] |

## 9.3 Màn hình Pha 2 (AI)

Mọi màn hình AI có `Alert` cố định: **"Gợi ý chỉ mang tính tham khảo, không phải chẩn đoán. Người xác nhận quyết định."**

| Mã | Màn hình (nhãn) | Actor | Việc chính | Component Ant Design | SPA |
|----|-----------------|-------|-----------|----------------------|-----|
| M22 | Kho tri thức | Q | Tải lên SOP và bảng giá, xem tài liệu AI đang dùng, bật/tắt, gỡ | `Upload.Dragger`, `Table`, `Tag`, `Switch`, `Modal` (xem trước văn bản trích), `Popconfirm` | 24 |
| M23 | Hỏi trợ lý | K, L, T, P | Chat tư vấn; chọn thú để dùng hồ sơ; hiện nguồn trích dẫn | `FloatButton` + `Drawer`, `List`, `Avatar`, `Input.TextArea`, `Button`, `Select`, `Tag` (nguồn), `Spin`, `Alert` | 23 |
| M24 | Gợi ý gói | K, L, Q | 1–3 gói kèm lý do, độ tin cậy, cảnh báo; nút "Chọn gói này" / "Không dùng". Mở từ M07 và M14 | `Modal`/`Drawer`, `Card`, `Progress`, `Tag`, `Alert` (đỏ/vàng), `Collapse` (lý do, dữ kiện), `Button`, `Spin`, `Empty` | 25, 26, 27 |
| M25 | Cảnh báo an toàn | Mọi actor nhân viên | Hiện ngay trên M06, M07, M09: đỏ (chặn) hoặc vàng (lưu ý) kèm lý do; Q có nút ghi đè | `Alert`, `Tag`, `Modal` + `Input.TextArea` (lý do ghi đè), `Badge` | 27 |
| M26 | Đến hạn tái spa | Q | Danh sách xếp hạng theo quá hạn; chọn duyệt gửi hoặc bỏ qua | `Table` có chọn hàng, `Tag`, `Button`, `Popconfirm`, `Statistic`, `Button` "Làm mới" | 28, 29 |
| M27 | Nhắc của tôi | K | Xem nhắc tái spa, đặt lịch từ nhắc, tắt nhận nhắc | `List`, `Card`, `Button`, `Switch` | 28 |
| M28 | Gợi ý kỹ thuật viên | L, Q | Trong M06/M07: danh sách thợ rảnh đúng chuyên môn kèm lý do; chọn tay vẫn được | `Select` kèm `Tag` "Gợi ý", `Tooltip`/`Popover` (lý do), `Table` nhỏ | 30 |
| M29 | Luật và chống chỉ định | Q | Sửa ma trận dịch vụ–chống chỉ định, danh mục thẻ sức khỏe, luật chu kỳ tái spa | `Tabs`, `Table` (sửa tại chỗ), `Select`, `Radio.Group` (warn/block), `InputNumber`, `Modal` | 27, 28 |
| M30 | Nhật ký AI | Q | Hỏi–đáp và gợi ý đã đưa, kèm chấp nhận/từ chối, nguồn đã dùng | `Tabs`, `Table`, `Tag`, `Descriptions`, `Drawer`, `RangePicker`, `Select` | 31 |

## 9.4 Luồng màn hình chính (demo)

1. M01 → M02 (khách) → M14 thêm thú → M24 gợi ý gói (có cảnh báo) → M07 đặt lịch → M08 (lễ tân duyệt) → M09 check-in → M06 (KTV xem an toàn, bắt đầu, hoàn tất) → M12 thu tiền → M03 dashboard tăng đúng một đơn.
2. M26 (đến hạn) → duyệt gửi → M27 khách xem nhắc.
3. M22 (kho tri thức) → M23 chatbot trả lời có nguồn → M30 nhật ký.

## 9.5 Tính liên kết dữ liệu xuyên suốt (Cross-matching)

Hệ thống được thiết kế theo nguyên tắc liên kết hữu cơ không rời rạc:
1. **Khách hàng ⟷ Thú cưng:**
   - Trong trang Khách hàng (`Clients.jsx`): Mỗi dòng hiển thị danh sách các thẻ thú cưng kèm kích cỡ. Bấm trực tiếp vào bé cưng hoặc nút "Xem thú cưng" sẽ mở hồ sơ chi tiết. Có nút "+ Thêm bé" tạo nhanh thú cưng gán trực tiếp cho khách hàng.
   - Trong trang Thú cưng (`Pets.jsx`): Cột "Chủ nuôi" là link điều hướng trực tiếp sang trang Khách hàng với từ khóa tìm kiếm theo tên hoặc SĐT của chủ.
2. **Khách hàng / Thú cưng ⟷ Lịch hẹn:**
   - Từ trang Khách hàng hoặc Thú cưng có nút bấm "Lịch hẹn" để lọc danh sách lịch hẹn của đúng khách/bé đó (`/app/lich-hen?q=...`).
   - Có nút "Đặt lịch ngay" truyền sẵn thông tin bé cưng vào form đặt lịch.
   - Trong trang Lịch hẹn (`Bookings.jsx`), tên bé và tên khách đều là link clickable dẫn sang hồ sơ tương ứng.
3. **Lịch hẹn ⟷ Hóa đơn:**
   - Lịch hẹn khi hoàn tất (COMPLETED) sẽ hiển thị trạng thái hóa đơn: Nếu đã có HĐ, có nút "Xem hóa đơn" nhảy sang trang Hóa đơn và tự mở Drawer chi tiết. Nếu chưa có HĐ, có nút "Lập HĐ & Thu tiền" nhảy sang trang Hóa đơn và tự mở Modal tạo HĐ điền sẵn ID lịch hẹn (`/app/hoa-don?booking_id=...`).
   - Trong trang Hóa đơn (`Invoices.jsx`): Cột số hóa đơn có link xem lại lịch hẹn nguồn; cột khách hàng và cột thú cưng đều có link mở xem hồ sơ khách/thú cưng.
4. **Dịch vụ & Giá ⟷ Đặt lịch & Hóa đơn:**
   - Trên từng thẻ dịch vụ và gói combo có nút "Đặt lịch ngay".
   - Khi lập hóa đơn walk-in trực tiếp tại quầy, danh mục dịch vụ và gói combo được tải tự động và đồng bộ giá theo size của bé đã chọn.
5. **Dashboard ⟷ Các phân hệ nghiệp vụ:**
   - Các thẻ thống kê số liệu (Doanh thu hôm nay, Lịch hôm nay, Lịch chờ duyệt, Hóa đơn chưa thanh toán) đều hỗ trợ click điều hướng kèm bộ lọc tương ứng để xử lý nghiệp vụ tức thì.
