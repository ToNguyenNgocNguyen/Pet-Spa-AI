# BÁO CÁO THIẾT KẾ & TRIỂN KHAI MODULE AI ASSISTANT (PHA 2)
**Hệ thống:** Pet Spa AI — Nền tảng Quản lý Spa Thú Y có AI Hỗ trợ  
**Đồ án:** Phân tích thiết kế hệ thống thông tin nâng cao — UIT, ĐHQG-HCM  
**GVHD:** TS. Cao Thị Nhạn  

---

## 1. NGUYÊN TẮC THIẾT KẾ CỐT LÕI (DESIGN PRINCIPLES)

1. **AI chỉ hỗ trợ gợi ý — Con người quyết định (Human-in-the-loop):**
   - Mọi đề xuất của AI (Gói dịch vụ, Kỹ thuật viên, Lời nhắc tái spa) đều lưu ở trạng thái `proposed` hoặc `suggested`.
   - Nhân viên Lễ tân, Quản lý hoặc Khách hàng trực tiếp bấm chọn và xác nhận mới sinh dữ liệu nghiệp vụ thật (Lịch hẹn, Hóa đơn).
   - Module `ai_assistant` không import bất kỳ hàm ghi trực tiếp nào của `Booking` hay `Invoice`.

2. **Quy tắc logic xác định (Deterministic Business Rules):**
   - Không dựa vào suy diễn ngẫu nhiên của LLM cho logic nghiệp vụ. Toàn bộ luật R1 - R7 và ma trận chống chỉ định được kiểm tra bằng code Python và truy vấn CSDL quan hệ.
   - LLM / Tri thức chỉ được sử dụng cho việc trích xuất văn bản SOP chuẩn xác và trả lời câu hỏi tự nhiên của khách hàng.

3. **An toàn y khoa tuyệt đối:**
   - Hệ thống spa thú cưng chỉ cung cấp dịch vụ vệ sinh thẩm mỹ.
   - Chatbot AI từ chối tư vấn dùng thuốc điều trị y tế hoặc chẩn đoán bệnh lý nguy hiểm; tự động hiển thị cảnh báo đỏ và hướng dẫn đưa thú cưng đến trạm thú y gần nhất.

---

## 2. KIẾN TRÚC VÀ CÁC THÀNH PHẦN ĐÃ XÂY DỰNG

### 2.1 Backend (`backend/ai_assistant/` & `backend/catalog/`)
- **Model `ServiceContraindication`:** Ma trận an toàn kiểm soát các cặp (Dịch vụ - Yếu tố sức khỏe dị ứng) với 2 mức độ:
  - `BLOCK`: Cấm tuyệt đối, tự động loại trừ khỏi danh sách đề xuất.
  - `WARN`: Cảnh báo rủi ro, trừ điểm phù hợp và hiển thị tag cảnh báo cho nhân viên.
- **Model `RebookRule` & `RebookReminder`:** Quy tắc chu kỳ theo loài, chất lông, thời gian ngày (ví dụ: Chó lông dài 6-8 tuần, tắm định kỳ 3-4 tuần).
- **Model `KnowledgeDoc` & `KnowledgeChunk`:** Kho tài liệu tri thức SOP và bảng giá dịch vụ hỗ trợ hỏi đáp chuẩn xác.
- **Model `AiLog` & `AiSuggestion`:** Nhật ký hoạt động minh bạch ghi nhận thời gian xử lý (ms), người gọi, nội dung input/output phục vụ audit.

### 2.2 Các Dịch Vụ AI (`ai_assistant/services.py`)
1. `suggest_packages(pet, user)`:
   - Áp dụng bộ luật R1 đến R7.
   - Quét ma trận `ServiceContraindication` để loại bỏ các gói chứa dịch vụ cấm với thú cưng dị ứng.
   - Tính điểm độ phù hợp (`score`) và độ tin cậy (`confidence`).
2. `suggest_staff(booking, user)`:
   - Đánh giá KTV rảnh trong ca làm việc, đúng chuyên môn yêu cầu.
   - Cộng điểm ưu tiên cho KTV đã từng phục vụ bé trước đó (tạo sự an tâm cho khách).
3. `generate_rebook_reminders()`:
   - Quét lịch sử các lịch hẹn hoàn tất.
   - Tính toán chu kỳ ngày và tự động sinh bản ghi nhắc tái spa trạng thái `suggested`.
4. `query_knowledge_chat(question, user)`:
   - Quét từ khóa và trích xuất các đoạn tri thức chuẩn xác nhất từ `KnowledgeChunk`.
   - Trả về câu trả lời kèm tài liệu nguồn và tiêu đề trích dẫn (`sources`).

---

## 3. GIAO DIỆN NGƯỜI DÙNG (FRONTEND)

1. **`LandingPage.jsx` & `AppLayout.jsx`:**
   - Nút nổi **Trợ lý AI (Robot Floating Widget)** ở góc màn hình.
   - Mở Drawer hỏi đáp về quy trình SOP, thời gian mở cửa, bảng giá theo size, xử lý dị ứng.
2. **`AiPackageModal.jsx`:**
   - Modal phân tích thông minh hiển thị: Thú cưng, size, dị ứng ghi nhận, gói bị cấm do chống chỉ định (BLOCK), danh sách gói gợi ý xếp theo điểm kèm lý do chi tiết và giá theo kích thước.
   - Tích hợp trực tiếp tại:
     - Màn hình **Hồ sơ thú cưng (`Pets.jsx`)** -> Nút "AI Gợi ý gói".
     - Màn hình **Đặt lịch hẹn (`Bookings.jsx`)** -> Nút "AI Gợi ý gói cho bé này" trong form tạo lịch.
3. **Màn hình Nhắc Tái Spa (`RebookReminders.jsx` — M26, M27):**
   - Quản lý / Lễ tân: Thống kê số lượng nhắc, nút "Quét & Sinh Nhắc Mới", nút "Duyệt & Gửi" thông báo qua hệ thống chuông real-time.
   - Khách hàng: Xem khuyến nghị chăm sóc định kỳ cho bé cưng kèm nút "Đặt lịch ngay theo gói này".
4. **Màn hình Quản Trị AI & SOP (`AiAdmin.jsx` — M22, M29, M30):**
   - Dành riêng cho Quản lý (`manager`).
   - 4 Tabs trực quan: Ma trận chống chỉ định, Luật chu kỳ tái spa, Kho tài liệu tri thức SOP, Nhật ký hoạt động minh bạch (AiLog).

---

## 4. KẾT QUẢ KIỂM THỬ (TEST RESULTS)

- **Bộ kiểm thử tự động backend:**
  - `accounts`: 22 test cases (phân quyền Role, đăng ký, đăng nhập token, profile).
  - `scheduling`: 31 test cases (state machine 6 bước, tính giá theo size, check slot xung đột, hóa đơn, thông báo).
  - `ai_assistant`: 6 test cases (luật R1-R7, chống chỉ định hóa chất BLOCK/WARN, gợi ý KTV, chatbot SOP, sinh nhắc tái spa).
  - **Tổng cộng: 59/59 test cases PASS 100% (thời gian chạy ~64s).**
- **Kiểm thử giao diện Frontend:**
  - `npm run build` hoàn thành không cảnh báo lỗi (0 error, exit code 0).
  - Các luồng tương tác giữa người dùng và AI trơn tru, chuẩn thiết kế Ant Design hiện đại.
