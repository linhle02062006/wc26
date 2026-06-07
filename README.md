# World Cup 2026 Watch Party (MVP)

Ứng dụng xem lịch thi đấu + tỉ số realtime công khai, và phòng xem chung riêng cho **host + 2 guest account**.

## Tính năng chính

- Public (không cần đăng nhập):
  - Xem trang chủ `/`
  - Xem lịch thi đấu `/schedule`
  - Xem tỉ số realtime + trạng thái trận qua Socket.IO
  - Không vào được room, không dùng mic, không xem stream room

- Host (đăng nhập `host`):
  - Vào `/admin`
  - Tạo / đóng room
  - Chia sẻ màn hình (WebRTC + `getDisplayMedia`)
  - Quản lý voice chat, mute all, mute/kick guest
  - Quản lý trận đấu + cập nhật tỉ số realtime
  - Quản lý 2 tài khoản guest

- Guest (`guest1`, `guest2`):
  - Phải đăng nhập mới vào room
  - Chỉ vào được room đang mở
  - Không có quyền admin/matches update
  - Có thể bật mic khi host cho phép
  - Xem stream host + tỉ số realtime trong room

## Tài khoản mặc định (seed tự động lần chạy đầu)

- Host:
  - username: `host`
  - password: `host123`

- Guest 1:
  - username: `guest1`
  - password: `guest123`

- Guest 2:
  - username: `guest2`
  - password: `guest123`

## Bảo mật / phân quyền

- Password được hash bằng `bcryptjs` ở backend.
- Xác thực bằng JWT Bearer token.
- Role rõ ràng:
  - `host`
  - `guest`
  - public (không token)
- API host-only được khóa bằng middleware `hostOnly`.
- API room chỉ cho `host|guest` bằng middleware `hostOrGuest`.
- Route room `/room/:roomId` trên frontend bắt buộc login, chưa login sẽ redirect:
  - `/login?redirect=/room/:roomId`
- Giới hạn room:
  - Tối đa 1 host + 2 guest
  - Guest trùng phiên sẽ bị chặn: **“Tài khoản này đang được sử dụng trong phòng.”**
  - Room đủ guest sẽ báo: **“Phòng đã đủ người xem.”**

## Công nghệ

- Node.js + Express
- Socket.IO (realtime score + signaling)
- WebRTC (screen share + voice)
- HTML/CSS/JS thuần (không framework phức tạp)

## Cài đặt & chạy

```bash
npm install
```

Tạo file `.env` từ `.env.example`:

```bash
copy .env.example .env
```

Chạy server:

```bash
npm start
```

Mở trình duyệt:

- `http://localhost:3000`

## Cấu trúc thư mục

```txt
.
├── server.js
├── .env.example
├── data/
│   ├── users.json        # tự tạo khi chạy lần đầu nếu chưa có
│   ├── matches.json
│   ├── settings.json
│   └── room.json
└── public/
    ├── index.html
    ├── schedule.html
    ├── login.html
    ├── admin.html
    ├── room.html
    ├── css/style.css
    └── js/
        ├── main.js
        ├── schedule.js
        ├── admin.js
        └── room.js
```

## Lưu ý pháp lý

Chỉ chia sẻ nguồn phát hợp pháp. Một số nguồn có DRM/bản quyền có thể không cho phép chia sẻ qua trình duyệt.
