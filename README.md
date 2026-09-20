# VioEdu

Ứng dụng lịch học VioEdu cho Thanh Phong, An Nguyên và Trà My. Giao diện ưu tiên điện thoại, lưu lịch cục bộ và đã chuẩn bị cấu trúc để kết nối Supabase.

## Chạy trên máy

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

## Supabase

1. Tạo project Supabase.
2. Chạy `supabase.sql` trong SQL Editor.
3. Sao chép `.env.example` thành `.env.local`.
4. Điền Project URL và Publishable Key.
5. Trước khi dùng production, bật RLS và cấu hình authentication/policies phù hợp.

## Vercel

Đẩy project lên GitHub, import repository vào Vercel và thêm hai biến môi trường tương tự `.env.local`.

## PWA

Project có `app/manifest.ts` và chế độ standalone. Có thể bổ sung icon và Web Push ở bước tiếp theo.
