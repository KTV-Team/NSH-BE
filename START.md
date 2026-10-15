# Cách chạy source NEXA

Mở terminal ở thư mục gốc dự án rồi làm lần lượt các bước dưới đây.

## 1. Cài những thứ cần dùng

Cần có Node.js từ bản 20, pnpm **10.29.3** và Docker Desktop. Muốn chạy Android thì cài thêm Android Studio và Android SDK. Với iOS, cần máy Mac có Xcode.

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Hai lệnh `Copy-Item` chỉ chạy lần đầu. Đã có file `.env` thì bỏ qua để giữ cấu hình cũ.

## 2. Điền file .env

Mở `apps/api/.env`, điền mật khẩu database vào `DB_PASSWORD`. Chạy lệnh này rồi lấy kết quả điền vào `AUTH_ACCESS_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Các dòng còn lại cứ giữ theo file mẫu. Tiếp theo, mở `apps/mobile/.env`, điền `EXPO_PUBLIC_API_URL` theo máy muốn test:

| Thiết bị         | Địa chỉ API                                |
| ---------------- | ------------------------------------------ |
| Android emulator | `http://10.0.2.2:4000/api/v1`              |
| iOS simulator    | `http://localhost:4000/api/v1`             |
| Điện thoại thật  | `http://<IP-LAN-máy-chạy-API>:4000/api/v1` |

Đổi URL xong thì chạy lại Metro. Giữ secret trong file `.env` của API, không cho vào biến `EXPO_PUBLIC_*` hay commit file `.env` lên Git.

## 3. Chạy backend và mobile

Mở Docker Desktop rồi chạy database:

```powershell
docker compose --env-file apps/api/.env up -d postgres
```

Đợi database sẵn sàng rồi chạy tiếp:

```powershell
pnpm --filter @nexa/api db:migration:run
pnpm dev:app
```

`dev:app` chạy cả API và Metro, là server nạp code cho app lúc phát triển. Mở [địa chỉ này](http://localhost:4000/api/v1/health) để kiểm tra API có chạy chưa.

Giữ terminal đang chạy, rồi chọn cách test ở phần dưới để cài bản development của app.

Muốn có dữ liệu mẫu thì đặt `ALLOW_DEV_SEED=true`, điền `DEV_SEED_PASSWORD` trong `apps/api/.env`, rồi chạy `pnpm --filter @nexa/api db:seed`. Không cần thì bỏ qua.

Test xong, nhấn `Ctrl+C` để dừng API và Metro. Muốn dừng cả database thì chạy `docker compose --env-file apps/api/.env stop postgres`.

## 4. Test trên emulator hoặc điện thoại thật

### Android emulator

1. Mở Android Studio → **Device Manager → Create Device**, tạo máy ảo rồi bấm chạy. Chưa biết cài SDK thì xem [hướng dẫn này](https://docs.expo.dev/workflow/android-studio-emulator/).
2. Trong `apps/mobile/.env`, điền `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1`. Nếu vừa đổi URL thì dừng và chạy lại `pnpm dev:app`.
3. Mở thêm terminal, chạy lệnh này rồi chọn máy ảo:

```powershell
pnpm --filter @nexa/mobile android --device --no-bundler
```

### Android thật

1. Bật **Developer options → USB debugging** trên điện thoại. Cắm cáp USB có truyền dữ liệu, rồi bấm cho phép gỡ lỗi khi điện thoại hỏi.
2. Chạy `adb devices`. Thấy trạng thái `device` là máy đã nhận điện thoại. Nếu hiện `unauthorized`, mở khóa điện thoại rồi bấm cho phép. Không tìm thấy lệnh `adb` thì thêm thư mục `platform-tools` của Android SDK vào `PATH`.
3. Cho máy tính và điện thoại vào cùng Wi-Fi. Trên Windows, chạy `ipconfig` để lấy IPv4 của mạng đang dùng. Điền vào `EXPO_PUBLIC_API_URL`, ví dụ `http://192.168.1.10:4000/api/v1`.
4. Chạy lại `pnpm dev:app`. Mở thêm terminal, chạy lệnh Android ở trên rồi chọn điện thoại để cài app. Cáp dùng để cài app, còn API kết nối qua Wi-Fi.

Nếu app không kết nối được, thử mở `http://<IP-LAN-máy-chạy-API>:4000/api/v1/health` trên trình duyệt điện thoại. Kiểm tra lại Wi-Fi, API và Windows Firewall. Trên mạng riêng, cần cho phép cổng **4000** của API và **8081** của Metro.

### iOS simulator và iPhone

Nếu dùng Mac, mở Simulator, đặt API URL là `http://localhost:4000/api/v1` nếu API cũng chạy trên Mac đó. Mở thêm terminal, chạy lệnh này rồi chọn simulator:

```powershell
pnpm --filter @nexa/mobile ios --device --no-bundler
```

Muốn test trên iPhone thật thì cắm vào Mac, bấm **Trust**, bật **Developer Mode** và thiết lập ký app trong Xcode. Cho iPhone vào cùng Wi-Fi với máy chạy API, dùng IP LAN như phần Android thật. Sau đó chạy lệnh iOS ở trên rồi chọn iPhone. Windows không build iOS trực tiếp được.

`--no-bundler` dùng lại Metro đang chạy ở phần 3. Lần sau chỉ cần chạy `pnpm dev:app` rồi mở app đã cài. Chỉ sửa code JS/TS thì không cần build lại; đổi native module hoặc cấu hình native thì cần. Chi tiết có trong [hướng dẫn của Expo](https://docs.expo.dev/guides/local-app-development/).
