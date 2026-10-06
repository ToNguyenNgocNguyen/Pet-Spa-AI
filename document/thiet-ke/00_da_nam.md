# 00. Đã nắm (kết quả Bước 0)

## Đã nắm

1. **Môn chấm gì:** PTTK HTTT nâng cao (TS. Cao Thị Nhạn, UIT). Cuối kỳ 50% là đồ án nhóm 3–4 người, hướng *Ứng dụng*: phân tích, thiết kế và xây một HTTT thực tế. Nộp báo cáo Word, PPT, báo cáo tại lớp. Slide nhấn mạnh: yêu cầu chức năng / phi chức năng, use case (include/extend, đặc tả), DFD, activity, sequence, ERD/lớp, quản lý dự án (ba ràng buộc, WBS, Gantt), kiểm thử, tài liệu, chuyển giao.
2. **Hệ thống của ai:** một spa thú y đô thị, tại chỗ, có tên giả định (hồ sơ SPA-01). Không phải sàn nhiều spa.
3. **Actor:** Khách hàng, Lễ tân, Kỹ thuật viên, Quản lý/chủ spa; AI Agent là actor hệ thống, đọc hồ sơ thú + catalog + tài liệu cơ sở rồi đưa gợi ý, người xác nhận.
4. **Dữ liệu từ đâu:** hồ sơ thú, lịch, hóa đơn do chính cơ sở sinh ra khi vận hành; catalog, giá, định mức do quản lý nhập; tri thức AI = 1 file SOP + 1 bảng giá/dịch vụ của spa. Số liệu thị trường chỉ để viết bối cảnh.
5. **Điểm tối ưu quy trình:** (1) chặn trùng slot và quá tải bàn/chuồng; (2) gợi ý gói đúng giống–tuổi–da lông, có lý do; (3) cảnh báo chống chỉ định hóa chất; (4) nhắc tái spa theo chu kỳ lông; (5) trừ kho khi hoàn tất (Pha 3).
6. **Bắt buộc, không được cắt (24):** Pha 1 gồm SPA-01, 02, 04–17, 19, 20 (18 mục); Pha 2 gồm SPA-23–28 (6 mục).
7. **Cố ý không làm:** đa chi nhánh, đặt lịch tại nhà, GPS/tuyến đường, chiến dịch marketing, website builder, bảng lương; AI không chẩn bệnh, không tự đặt lịch. Pha 3 để giai đoạn sau; Pha 4 không đưa vào use case chính.
8. **Thứ tự:** Pha 1 chạy được một vòng đời thú (đặt lịch → nhận → làm → thu tiền) rồi mới Pha 2. Không làm chatbot trước khi có thú và lịch. Trễ thì cắt Pha 3.

## Cảnh báo về tài liệu đầu vào

| # | Vấn đề | Cách xử lý trong thiết kế |
|---|--------|---------------------------|
| 1 | **Thiếu sheet `04_NgoaiPhamVi`** trong `ChucNang_HeThong_SpaThuY_AI.xlsx`. Sheet `00_TomTat` nói "04_NgoaiPhamVi: cố ý không làm" và `07_ThongKe` nói 12 hạng mục ngoài phạm vi, nhưng file chỉ có 7 sheet (00, 01, 02, 03, 05, 06, 07), không có sheet ẩn. | Mục ngoài phạm vi trong [11_ngoai_pham_vi.md](11_ngoai_pham_vi.md) chỉ dùng 6 mục do yêu cầu giao việc nêu. **Cần nhóm gửi sheet 04 để đối chiếu đủ 12 mục.** |
| 2 | `DeXuat_DoAn...docx` mô tả **chuỗi** spa, microservice, API Gateway, Vector DB, cổng thanh toán, SMS/Zalo OA, Mobile App, PostgreSQL/MySQL, Node/Spring/FastAPI. | Mâu thuẫn với phần đã chốt (một cơ sở, Django, React, SQLite). **Theo phần đã chốt.** Đề xuất chỉ dùng làm tham khảo bối cảnh và ý tưởng use case. |
| 3 | Đề xuất docx xếp "kho vật tư" thành chức năng lõi; xlsx xếp kho vào Pha 3. | Theo xlsx: kho là Pha 3, giai đoạn sau. |
| 4 | Ma trận `05_TheoNguoiDung` chỉ có 34 dòng (không phủ hết 31 chức năng Pha 1–2) và SPA-02 ghi 3 vai trò trong khi use case có 4 actor người. | Dòng nào có trong ma trận thì giữ nguyên. Dòng thiếu do nhóm đề xuất, đánh dấu `(*)` ở [02_actor_phan_quyen.md](02_actor_phan_quyen.md). Tách Lễ tân / Kỹ thuật viên bằng quyền trang theo ghi chú SPA-02. |
| 5 | Ma trận ghi "ô A = include tới use case AI". | Giữ ý này, tinh chỉnh theo UML: bước AI luôn chạy thì `<<include>>`, bước AI người có thể bỏ qua thì `<<extend>>`. Xem [04_use_case.md](04_use_case.md). |
| 6 | Hình trong slide (PDF) và hình use case/kiến trúc trong docx là ảnh. Đã xem hai hình của docx. Với slide chỉ trích được văn bản. | Slide chủ yếu là lý thuyết, không có yêu cầu riêng cho đề tài. Không ảnh hưởng thiết kế. |

## Giả định đã dùng, cần nhóm xác nhận

- Tên, địa chỉ, quy mô spa là **giả định** (xem [01_to_chuc_bai_toan.md](01_to_chuc_bai_toan.md)).
- Hiện trạng "quy trình cũ" được suy từ `01_PhamVi` ("đang nằm trên tin nhắn và sổ tay"); chưa có phỏng vấn thật. Nếu giảng viên yêu cầu khảo sát, nhóm cần tự phỏng vấn một spa thật.
- Nhà cung cấp LLM chưa chốt (xem [07_kien_truc.md](07_kien_truc.md)).
