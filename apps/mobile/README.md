# NEXA Mobile

Expo + React Native + TypeScript trong workspace pnpm/Turborepo. Trạng thái triển khai bên dưới được kiểm chứng từ mã nguồn mobile/API, không suy ra từ mẫu giao diện.

Sản phẩm hiện được xác nhận là ứng dụng **thông báo cá nhân và quản lý bạn bè cho Android/iOS**, dùng chung backend. Xem [chức năng và màn hình MVP](../../docs/app-functions-and-screens.md). Mobile đã nối auth, hồ sơ và kết bạn với backend; màn thông báo/inbox vẫn là giao diện mẫu. Realtime và native push chưa tích hợp. Thông báo phải hỗ trợ cả đang mở, chạy nền/khóa màn hình và đã đóng app trên Android/iOS. Nguồn yêu cầu duy nhất là task brief người dùng cung cấp đầu cuộc chat và các xác nhận bổ sung. HTML chỉ dùng chốt UI/UX; không quy định mục đích app, tính năng hay nghiệp vụ.

## Phạm vi hiện tại

- Form tiếng Việt, validation khi rời trường/khi gửi, focus vào lỗi đầu tiên, nút hiện/ẩn mật khẩu và checklist mật khẩu trực tiếp.
- Điều hướng đăng nhập/đăng ký, safe area, cuộn và xử lý bàn phím trong mã native hiện có.
- Loading, khóa gửi form khi pending và ánh xạ lỗi kết nối/timeout, thông tin không hợp lệ, email trùng, HTTP 429 từ dịch vụ. Đây không phải bằng chứng backend đã chống trùng hoặc giới hạn thử lại.
- Session provider, kiểm tra phiên khi mở app, refresh token trước request khi sắp hết hạn, route bảo vệ và đăng xuất.
- Hồ sơ tải lại từ API khi mở, sửa tên/URL ảnh HTTPS và xóa avatar; tìm theo tên hoặc email chính xác, xem trạng thái quan hệ, gửi lời mời, chấp nhận/từ chối/hủy lời mời, xem/hủy bạn bè. Danh sách có tải thêm, trạng thái rỗng và thử lại khi lỗi.
- Nút Google chỉ báo chức năng đang phát triển; chưa có Google sign-in.
- Native dùng Expo SecureStore; không lưu mật khẩu. Bỏ chọn duy trì đăng nhập chỉ giữ phiên trong bộ nhớ. Web preview dùng `sessionStorage` trong tab hiện tại.
- Noto Sans 400/500/600 đóng gói trong app, dùng được offline, theo fallback của DESIGN.md.

Backend auth, hồ sơ và quan hệ bạn bè hiện dùng PostgreSQL. Cần khởi động cơ sở dữ liệu và chạy migration trước khi thử trên thiết bị. Trang `/` vẫn là inbox UI scaffold, chưa nối API thông báo.

## Yêu cầu thông báo trong cả ba trạng thái — chưa triển khai

| Trạng thái app              | Hành vi cần triển khai                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Đang mở                     | Inbox/count cập nhật realtime; thống nhất hiển thị trong app và push để không tạo bản ghi hoặc cảnh báo trùng.               |
| Chạy nền hoặc khóa màn hình | Hệ điều hành hiển thị native push khi được phép; backend vẫn xử lý lịch/lặp và lưu inbox, không phụ thuộc app chạy liên tục. |
| Đã đóng                     | OS có thể hiển thị push; chạm thông báo khởi động app, khôi phục/yêu cầu đăng nhập rồi mở đích được phép.                    |

Cần thiết kế quyền thông báo, đăng ký/token thiết bị theo tài khoản, rotation/token hết hiệu lực, logout/đổi tài khoản, payload riêng tư trên màn khóa, retry/expiry và đồng bộ inbox khi mở lại. Nhà cung cấp push chưa được chọn; chưa có package/API/config tích hợp push trong repository.

Kiểm thử native phải bao phủ ba trạng thái với thông báo cá nhân/bạn bè/sự kiện xã hội, hẹn giờ và từng lần lặp; thêm trường hợp từ chối quyền, mất mạng, OS hạn chế/Force stop, trùng realtime/push và tap khi app chưa chạy. Inbox backend phải giữ dữ liệu ngay cả khi push không hiển thị. Android Force stop trong Settings cần mở lại app; không coi đó là trạng thái đóng bình thường. Expo browser preview và QA auth cũ không xác minh native push. Xem [chức năng và màn hình MVP](../../docs/app-functions-and-screens.md) và [hành vi nền tảng](https://docs.expo.dev/push-notifications/what-you-need-to-know/).

## Chạy từ repository root

```powershell
pnpm install
pnpm dev:app
# Preview tùy chọn trong browser, phục vụ kiểm tra mobile; không phải sản phẩm web:
pnpm --filter @nexa/mobile exec expo start --web
# Native local build, cần Android SDK / macOS + Xcode tương ứng:
pnpm --filter @nexa/mobile android
pnpm --filter @nexa/mobile ios
```

SDK 53 trở lên, Expo Go không hỗ trợ push từ xa trên Android. NEXA bỏ qua đăng ký push khi chạy trong Expo Go; để kiểm thử push, cài development build bằng `pnpm --filter @nexa/mobile android` (iOS cần macOS/Xcode với lệnh tương ứng), rồi chạy `pnpm dev:app`. Script `dev` khởi động Metro ở chế độ development client.

Expo Go cần phiên bản hỗ trợ SDK của dự án. Bộ chọn ngày giờ và quản lý bàn phím dùng native modules; sau khi thêm hoặc đổi phiên bản, rebuild development/native app tương ứng. Xem [hướng dẫn backend và PostgreSQL](../../README.md#local-development) trước khi chạy app.

## Địa chỉ API

Sao chép `apps/mobile/.env.example` thành `apps/mobile/.env` và đặt `EXPO_PUBLIC_API_URL`. Ví dụ dùng localhost: cần đổi trước khi chạy Android emulator/điện thoại thật. Biến `EXPO_PUBLIC_*` được đóng gói vào client: chỉ chứa URL công khai, không chứa secret. API nạp `apps/api/.env` ở chế độ development; xem [README gốc](../../README.md).

| Môi trường          | API URL                                        |
| ------------------- | ---------------------------------------------- |
| Android emulator    | `http://10.0.2.2:4000/api/v1`                  |
| iOS simulator / web | `http://localhost:4000/api/v1`                 |
| Điện thoại thật     | `http://<IP-LAN-của-máy-chạy-API>:4000/api/v1` |
| Release             | URL HTTPS của backend triển khai               |

Nếu không có biến môi trường, app tự chọn địa chỉ emulator tương ứng. Đổi URL cần khởi động lại Metro. Với điện thoại thật, máy API và điện thoại cần truy cập được nhau. Web preview cần backend cho phép CORS origin của Metro.

## Cấu trúc

```text
app/                                      Expo Router routes và layout, không chứa screen implementation
src/layouts/                              Implementation root layout, tách khỏi route entry point
src/features/auth/screens/login/          Screen đăng nhập, cùng code riêng của form
src/features/auth/screens/register/       Screen đăng ký và schema confirm-password
src/features/auth/screens/account-session/ Landing phiên đăng nhập hiện có
src/features/auth/components/             UI dùng chung trong feature auth
src/features/auth/hooks/                  Hook form dùng giữa các màn auth
src/features/auth/                        Provider, service, session storage và errors
src/components/                           Mỗi UI component dùng chung có file riêng
src/theme/                                Typography adapter dùng shared token
src/config/                               URL môi trường
tests/features/auth/                      Test service auth, ngoài src và theo cấu trúc source
tests/features/auth/screens/register/     Test schema form đăng ký
```

Code chỉ dùng ở một màn hình/component được đặt cạnh nơi sử dụng. Style component nằm trong file `<component>.styles.ts` kế bên; object style động nhỏ phụ thuộc state có thể ở trong JSX. Test nằm trong `tests/`, ngoài `src/`, theo đúng đường dẫn source. Code dùng trong auth giữ ở auth; UI dùng giữa các feature nằm trong `src/components`. DTO nằm trong `packages/types`, schema request chung trong `packages/validation`, HTTP client trong `packages/api-client`, style lấy từ `packages/design-tokens`. Schema xác nhận mật khẩu thuộc màn đăng ký; request chỉ gửi tên/email/mật khẩu, không gửi mật khẩu xác nhận hoặc role do client cung cấp.

## Kiểm tra và build

```powershell
pnpm --filter @nexa/mobile typecheck
pnpm --filter @nexa/mobile lint
pnpm --filter @nexa/mobile test
pnpm --filter @nexa/mobile build
pnpm --filter @nexa/mobile exec expo install --check
```

`build` export bundle Android, iOS và browser preview vào `dist` theo config hiện có; output browser không mở rộng MVP sang web. Đây không phải APK/IPA đã ký. `eas.json` có profile `preview` (Android APK, iOS simulator) và `production`. Native/cloud build cần tài khoản EAS, API và signing phù hợp. Bundle Android/iOS export thành công; chưa kiểm thử runtime trên thiết bị.

Hành vi client được kiểm tra trong [auth service tests](tests/features/auth/auth-service.test.ts) và [registration schema tests](tests/features/auth/screens/register/register-form-schema.test.ts); backend xác thực nằm trong [auth controller](../api/src/auth/auth.controller.ts).
