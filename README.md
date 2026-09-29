# AutoCare

Ứng dụng quản lý xe và bảo dưỡng, xây dựng bằng React, Vite, Tailwind CSS, Express, SQLite và JWT.

## Yêu cầu

- Node.js 22.5 trở lên (khuyến nghị Node.js 24 LTS)

SQLite được tích hợp trong Node.js nên không cần cài MySQL Server, MySQL Workbench hoặc chạy dịch vụ database riêng.

## Chạy ứng dụng

Mở terminal tại thư mục `autocare`:

```powershell
npm.cmd install
npm.cmd run dev:api
```

Backend tạo tự động file database `database/autocare.sqlite` khi khởi động. Có thể đổi vị trí bằng cách sao chép `.env.example` thành `.env` rồi sửa `SQLITE_DATABASE_PATH`.

JWT_SECRET là tùy chọn khi phát triển trên máy cá nhân. Trước khi triển khai lên mạng, hãy đặt JWT_SECRET thành một chuỗi bí mật dài, ngẫu nhiên, không chia sẻ chuỗi đó và không đưa file `.env` lên Git.

Giữ terminal đó mở. Mở một terminal thứ hai tại cùng thư mục và chạy:

```powershell
npm.cmd run dev
```

Mở địa chỉ frontend Vite (thường là `http://localhost:5173`). Các request bắt đầu bằng `/api` được Vite chuyển đến Express tại cổng 3001.

## Kiểm tra API

- `http://localhost:3001/api/health` kiểm tra Express.
- `http://localhost:3001/api/health/database` kiểm tra kết nối SQLite.
- `GET /api/dashboard` lấy số xe, chi phí bảo dưỡng và lần bảo dưỡng gần nhất của tài khoản.
- `POST /api/auth/register` tạo tài khoản mới.
- `POST /api/auth/login` đăng nhập và nhận JWT.
- `GET /api/auth/me` xem hồ sơ đang đăng nhập.
- `PATCH /api/auth/me` cập nhật họ tên và email.
- `PATCH /api/auth/password` đổi mật khẩu với mật khẩu hiện tại.
- `POST /api/auth/logout` đăng xuất và thu hồi token hiện tại.
- `GET /api/cars` xem danh sách xe của tài khoản hiện tại.
- `POST /api/cars` thêm xe.
- `POST /api/cars/demo` thêm hai xe minh họa khi tài khoản chưa có xe.
- `PATCH /api/cars/:id` sửa thông tin xe.
- `DELETE /api/cars/:id` xóa xe.
- `GET /api/cars/:carId/maintenance` xem lịch sử bảo dưỡng của xe.
- `POST /api/cars/:carId/maintenance` thêm lịch sử bảo dưỡng.
- `POST /api/cars/:carId/maintenance/demo` thêm hai lần bảo dưỡng minh họa khi xe chưa có lịch sử.
- `PATCH /api/maintenance/:id` sửa lịch sử bảo dưỡng.
- `DELETE /api/maintenance/:id` xóa lịch sử bảo dưỡng.
- `GET /api/schedules` xem lịch nhắc của tài khoản.
- `POST /api/cars/:carId/schedules` tạo lịch nhắc theo km, ngày hoặc cả hai.
- `POST /api/cars/:carId/schedules/demo` thêm hai lịch mẫu cho xe chưa có lịch nhắc.
- `PATCH /api/schedules/:id` sửa lịch nhắc.
- `DELETE /api/schedules/:id` xóa lịch nhắc.

Các API hồ sơ cần gửi JWT trong header `Authorization: Bearer <token>`. Giao diện lưu token trong `localStorage` theo lựa chọn cho Phase 3; cách này dễ làm nhưng JavaScript chạy trên trang cũng có thể đọc token, vì vậy cần bảo vệ ứng dụng khỏi XSS.

Mật khẩu được băm bằng bcrypt trước khi lưu. JWT hết hạn sau 2 giờ; đăng xuất hoặc cập nhật hồ sơ sẽ thu hồi các token đã cấp cho tài khoản trước đó.

## Chạy bản production trên một máy chủ

Ứng dụng hỗ trợ phục vụ giao diện React đã build và API Express từ cùng một máy chủ:

```powershell
$env:NODE_ENV = "production"
$env:JWT_SECRET = (node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
$env:SQLITE_DATABASE_PATH = "C:\autocare-data\autocare.sqlite"
npm.cmd run build
npm.cmd start
```

Giữ bí mật giá trị `JWT_SECRET`, không gửi nó trong tin nhắn hay đưa vào Git. Tạo thư mục `C:\autocare-data` trước khi chạy nếu tài khoản máy chủ chưa có quyền tự tạo thư mục đó. Dùng HTTPS khi đưa ứng dụng lên Internet.

SQLite cần ổ đĩa lưu trữ bền vững và chỉ phù hợp chạy một bản backend tại một thời điểm. Trên dịch vụ hosting, hãy gắn persistent disk và đặt `SQLITE_DATABASE_PATH` tới disk đó; nếu nhà cung cấp không hỗ trợ persistent disk hoặc cần chạy nhiều bản backend, chưa triển khai theo cấu hình SQLite hiện tại vì dữ liệu có thể mất hoặc không đồng bộ.

Lệnh kiểm tra frontend:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Nếu PowerShell chặn `npm.ps1`, hãy dùng `npm.cmd` như các lệnh trên; không cần thay đổi chính sách bảo mật của PowerShell.

Phase 3 bổ sung đăng ký, đăng nhập, đăng xuất và chỉnh sửa hồ sơ. Phase 4 bổ sung CRUD xe, gắn xe với tài khoản đang đăng nhập. Phase 5 bổ sung CRUD lịch sử bảo dưỡng cho xe. Phase 6 bổ sung lịch nhắc theo km/ngày và cảnh báo trong ứng dụng; chưa gửi email hoặc thông báo điện thoại. Phase 7 hiển thị số xe, chi phí bảo dưỡng, lần bảo dưỡng gần nhất và lịch cần chú ý trên dashboard. Phase 8 hoàn thiện kiểm tra dữ liệu ở biểu mẫu, thông báo lỗi khi không tải được dữ liệu và bố cục responsive cho điện thoại. Phase 9 bổ sung kiểm thử, headers bảo mật, giới hạn kích thước request và cách chạy production một máy chủ; việc triển khai lên nhà cung cấp cụ thể cần chọn hosting có ổ lưu trữ bền vững cho SQLite. Có thể thêm dữ liệu xe, lịch sử và lịch nhắc minh họa bằng các nút mẫu trên trang; dữ liệu mẫu được đánh dấu rõ ràng. Ảnh xe hiện là URL tùy chọn; chức năng tải ảnh lên chưa được thêm để giữ cách làm đơn giản.
