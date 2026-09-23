import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContactEmail, ContactMissingNotice, LegalPage, Section, Steps } from "@/components/LegalPage";
import { APP_NAME, DATA_DELETION_RESPONSE_TIME } from "@/components/legal-config";

export const metadata: Metadata = {
  title: `Xóa dữ liệu | ${APP_NAME}`,
  description: `Hướng dẫn yêu cầu xóa dữ liệu khỏi ${APP_NAME}.`,
};

const responseTime = DATA_DELETION_RESPONSE_TIME.trim();

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Yêu cầu xóa dữ liệu"
      intro={`Trang này hướng dẫn cách yêu cầu xóa dữ liệu liên quan đến tài khoản ${APP_NAME} của bạn.`}
    >
      <ContactMissingNotice />

      <Section title="1. Những dữ liệu có thể liên quan">
        <p>Yêu cầu xóa dữ liệu có thể bao gồm:</p>
        <Bullets
          items={[
            "Tài khoản đăng nhập của bạn trong ứng dụng.",
            <>Các nhóm bạn đã tạo (<code className="rounded bg-slate-100 px-1 text-[13px]">groups</code>).</>,
            <>Học sinh trong các nhóm đó (<code className="rounded bg-slate-100 px-1 text-[13px]">group_members</code>).</>,
            <>Lịch học đã tạo (<code className="rounded bg-slate-100 px-1 text-[13px]">schedules</code>).</>,
            "Thông tin hồ sơ cơ bản nhận từ nhà cung cấp đăng nhập, ví dụ email, tên hiển thị và ảnh đại diện.",
          ]}
        />
      </Section>

      <Section title="2. Cách yêu cầu xóa dữ liệu">
        <p>
          Bạn có thể tự xóa phần lớn dữ liệu ngay trong ứng dụng. Riêng tài khoản đăng nhập cần gửi
          yêu cầu, vì ứng dụng hiện <b>chưa có chức năng tự động xóa tài khoản</b> từ phía người dùng.
        </p>
        <Steps
          items={[
            <>Đăng nhập vào {APP_NAME}.</>,
            <>
              Vào tab <b>Cài đặt</b>. Trong mục <b>Nhóm của tôi</b>, mở menu <b>⋮</b> ở nhóm bạn muốn
              xóa rồi chọn <b>Xóa nhóm</b>. Thao tác này xóa luôn toàn bộ học sinh và lịch học thuộc
              nhóm đó. Bạn cũng có thể xóa từng học sinh ở tab <b>Học sinh</b>, hoặc từng buổi học
              ở tab <b>Lịch</b>.
            </>,
            <>
              Để xóa nốt tài khoản và phần dữ liệu còn lại, gửi email tới <ContactEmail /> với tiêu đề{" "}
              <b>&quot;Xóa tài khoản {APP_NAME}&quot;</b>.
            </>,
          ]}
        />
        <p className="rounded-2xl bg-slate-100 p-4 text-sm">
          Lưu ý: xóa nhóm, học sinh hay lịch học là thao tác <b>không thể hoàn tác</b>. Ứng dụng
          không có thùng rác và không giữ bản sao lưu để khôi phục cho từng người dùng.
        </p>
      </Section>

      <Section title="3. Thông tin cần gửi kèm">
        <p>Để chúng tôi xác định đúng tài khoản, email yêu cầu chỉ cần:</p>
        <Bullets
          items={[
            "Địa chỉ email bạn dùng để đăng nhập ứng dụng.",
            <>Câu yêu cầu rõ ràng, ví dụ &quot;Xóa tài khoản {APP_NAME}&quot;.</>,
          ]}
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900">
          <b>Đừng bao giờ gửi kèm:</b> mật khẩu ứng dụng, mật khẩu Google, mật khẩu Facebook, mã OTP,
          access token hay bất kỳ khóa bí mật nào. Chúng tôi không bao giờ hỏi những thông tin này, và
          không cần chúng để xử lý yêu cầu xóa dữ liệu.
        </div>
      </Section>

      <Section title="4. Đăng nhập bằng Facebook">
        <p>
          Nếu bạn đăng nhập {APP_NAME} bằng Facebook, bạn vẫn có thể yêu cầu chúng tôi xóa dữ liệu mà
          ứng dụng lưu ở phía mình, theo đúng các bước ở mục 2.
        </p>
        <p>
          Yêu cầu này chỉ tác động đến dữ liệu trong {APP_NAME}. Nó <b>không</b> xóa tài khoản
          Facebook của bạn và không xóa dữ liệu do Meta lưu trên hệ thống của họ — chúng tôi không có
          quyền làm việc đó.
        </p>
        <p>
          Bạn có thể gỡ liên kết ứng dụng khỏi tài khoản Facebook trong phần <b>Cài đặt và quyền
          riêng tư → Cài đặt → Ứng dụng và trang web</b> trên Facebook.
        </p>
      </Section>

      <Section title="5. Đăng nhập bằng Google">
        <p>
          Tương tự Facebook: nếu bạn đăng nhập bằng Google, yêu cầu xóa dữ liệu áp dụng cho dữ liệu
          {" "}{APP_NAME} lưu giữ, không áp dụng cho tài khoản Google của bạn.
        </p>
        <p>
          Bạn có thể gỡ quyền truy cập của ứng dụng tại trang quản lý tài khoản Google, mục{" "}
          <b>Bảo mật → Ứng dụng của bên thứ ba có quyền truy cập vào tài khoản</b>.
        </p>
      </Section>

      <Section title="6. Thời gian xử lý">
        {responseTime ? (
          <p>Chúng tôi xử lý các yêu cầu xóa dữ liệu {responseTime}.</p>
        ) : (
          <p>
            Chúng tôi xử lý các yêu cầu xóa dữ liệu trong thời gian hợp lý sau khi nhận được và xác
            minh yêu cầu. Nếu cần biết tiến độ cụ thể, bạn có thể hỏi lại qua chính email đã gửi yêu
            cầu.
          </p>
        )}
      </Section>

      <Section title="7. Liên hệ">
        <p>
          Mọi yêu cầu và thắc mắc về xóa dữ liệu, gửi tới: <ContactEmail />
        </p>
        <p>
          Bạn cũng có thể xem thêm{" "}
          <Link href="/privacy" className="font-bold text-indigo-600 hover:underline">
            Chính sách quyền riêng tư
          </Link>{" "}
          để biết ứng dụng lưu những dữ liệu nào.
        </p>
      </Section>
    </LegalPage>
  );
}
