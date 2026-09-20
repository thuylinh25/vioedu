import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContactEmail, ContactMissingNotice, LegalPage, Section } from "@/components/LegalPage";
import { APP_NAME } from "@/components/legal-config";

export const metadata: Metadata = {
  title: `Chính sách quyền riêng tư | ${APP_NAME}`,
  description: `Chính sách quyền riêng tư của ứng dụng ${APP_NAME}.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Chính sách quyền riêng tư"
      intro={`Trang này giải thích ${APP_NAME} nhận những dữ liệu nào, dùng vào việc gì và bạn có thể làm gì với dữ liệu của mình.`}
    >
      <ContactMissingNotice />

      <Section title="1. Giới thiệu">
        <p>
          {APP_NAME} là ứng dụng giúp bạn quản lý lịch học theo nhóm. Trong ứng dụng, bạn có thể tạo
          nhóm, thêm thành viên vào nhóm, lên lịch học cho từng thành viên và đánh dấu buổi học đã
          hoàn thành.
        </p>
        <p>
          Chính sách này mô tả đúng những gì phiên bản hiện tại của ứng dụng thực sự làm. Nếu chức
          năng thay đổi, chúng tôi sẽ cập nhật lại trang này.
        </p>
      </Section>

      <Section title="2. Dữ liệu tài khoản">
        <p>
          Tùy cách bạn chọn đăng nhập, ứng dụng có thể nhận một số thông tin cơ bản từ nhà cung cấp
          xác thực:
        </p>
        <Bullets
          items={[
            "Địa chỉ email.",
            "Tên hiển thị, nếu nhà cung cấp gửi kèm.",
            "Ảnh đại diện, nếu nhà cung cấp gửi kèm.",
            "Một mã định danh tài khoản dùng cho việc xác thực và gắn dữ liệu của bạn với đúng tài khoản.",
          ]}
        />
        <p>
          Ứng dụng chỉ đọc những trường trên để hiển thị trong phần Cài đặt. Ứng dụng không đọc danh
          bạ, danh sách bạn bè, bài đăng hay bất kỳ dữ liệu nào khác từ tài khoản mạng xã hội của bạn.
        </p>
      </Section>

      <Section title="3. Đăng nhập bằng mạng xã hội">
        <p>Hiện tại ứng dụng hỗ trợ ba cách đăng nhập:</p>
        <Bullets
          items={[
            "Đăng nhập bằng Google.",
            "Đăng nhập bằng Facebook.",
            "Đăng nhập bằng email và mật khẩu, thông qua Supabase Auth.",
          ]}
        />
        <p>
          Khi bạn chọn Google hoặc Facebook, bạn nhập mật khẩu trên trang của chính nhà cung cấp đó.
          {" "}<b>{APP_NAME} không nhận và không lưu mật khẩu Google hay Facebook của bạn.</b> Việc xác
          thực do nhà cung cấp và Supabase Auth thực hiện; ứng dụng chỉ nhận lại kết quả đăng nhập
          cùng các thông tin cơ bản nêu ở mục 2.
        </p>
      </Section>

      <Section title="4. Dữ liệu do bạn tạo trong ứng dụng">
        <p>Khi sử dụng ứng dụng, bạn tự nhập và lưu các dữ liệu sau:</p>
        <Bullets
          items={[
            "Tên nhóm.",
            "Tên thành viên trong nhóm.",
            "Lịch học: ngày, giờ bắt đầu và thời lượng.",
            "Trạng thái hoàn thành của từng buổi học.",
          ]}
        />
        <p>
          Ứng dụng không có chức năng tải lên tệp hay ảnh, nên những dữ liệu kể trên là toàn bộ nội
          dung bạn tạo ra trong ứng dụng.
        </p>
      </Section>

      <Section title="5. Mục đích sử dụng dữ liệu">
        <Bullets
          items={[
            "Xác thực và giữ bạn đăng nhập.",
            "Hiển thị danh sách nhóm và thành viên của bạn.",
            "Lưu và đồng bộ lịch học giữa các thiết bị dùng cùng tài khoản.",
            "Tính và hiển thị tiến độ hoàn thành.",
          ]}
        />
        <p>
          Ứng dụng không sử dụng dữ liệu của bạn cho quảng cáo. Ứng dụng hiện không tích hợp công cụ
          phân tích hành vi (analytics), pixel theo dõi hay dịch vụ quảng cáo nào.
        </p>
      </Section>

      <Section title="6. Lưu trữ dữ liệu">
        <p>
          Ứng dụng sử dụng <b>Supabase</b> cho cả phần xác thực và cơ sở dữ liệu. Tài khoản và dữ
          liệu bạn tạo được lưu trong dự án Supabase của ứng dụng.
        </p>
        <p>
          Phiên đăng nhập được thư viện Supabase Auth lưu trên trình duyệt của bạn để bạn không phải
          đăng nhập lại mỗi lần mở ứng dụng. Ngoài cơ chế này, ứng dụng không đặt thêm cookie theo dõi
          nào.
        </p>
      </Section>

      <Section title="7. Chia sẻ dữ liệu">
        <p>
          Ứng dụng không bán dữ liệu của bạn. Tuy nhiên, để vận hành được, dữ liệu cần được xử lý bởi
          các nhà cung cấp hạ tầng và xác thực sau:
        </p>
        <Bullets
          items={[
            "Supabase — lưu trữ tài khoản và cơ sở dữ liệu.",
            "Nhà cung cấp đăng nhập mà chính bạn chọn: Google hoặc Facebook.",
            "Nhà cung cấp dịch vụ lưu trữ nơi ứng dụng được triển khai.",
          ]}
        />
        <p>
          Mỗi nhà cung cấp trên có chính sách quyền riêng tư riêng, áp dụng cho phần dữ liệu họ xử lý.
        </p>
      </Section>

      <Section title="8. Bảo mật">
        <p>Ứng dụng áp dụng các biện pháp sau:</p>
        <Bullets
          items={[
            "Mọi truy cập dữ liệu đều yêu cầu đăng nhập.",
            "Cơ sở dữ liệu dùng chính sách phân quyền ở mức dòng dữ liệu (Row Level Security) để giới hạn những gì mỗi tài khoản được đọc và ghi.",
            "Khi chạy trên môi trường production, ứng dụng được truy cập qua HTTPS.",
          ]}
        />
        <p>
          Chúng tôi không thể cam kết an toàn tuyệt đối — không hệ thống nào làm được điều đó. Nếu bạn
          phát hiện vấn đề bảo mật, hãy liên hệ theo địa chỉ ở mục 13.
        </p>
      </Section>

      <Section title="9. Quyền của bạn">
        <Bullets
          items={[
            "Xem, sửa và xóa nhóm, thành viên, lịch học của mình ngay trong ứng dụng.",
            "Đăng xuất khỏi thiết bị bất kỳ lúc nào trong phần Cài đặt.",
            "Yêu cầu xóa dữ liệu và tài khoản.",
            "Ngừng sử dụng ứng dụng bất kỳ lúc nào.",
          ]}
        />
      </Section>

      <Section title="10. Xóa dữ liệu">
        <p>
          Bạn có thể yêu cầu xóa dữ liệu liên quan đến tài khoản của mình. Hướng dẫn chi tiết nằm ở
          trang riêng.
        </p>
        <p>
          <Link
            href="/data-deletion"
            className="inline-flex min-h-[44px] items-center rounded-2xl bg-indigo-600 px-5 font-bold text-white transition hover:bg-indigo-700"
          >
            Xem hướng dẫn xóa dữ liệu
          </Link>
        </p>
      </Section>

      <Section title="11. Dữ liệu của trẻ em">
        <p>
          Ứng dụng được thiết kế cho người quản lý lịch học — thường là phụ huynh hoặc giáo viên —
          chứ không dành cho trẻ em tự đăng ký tài khoản.
        </p>
        <p>
          Tên thành viên trong nhóm do <b>người quản lý tài khoản tự nhập</b>. Người quản lý tài khoản
          chịu trách nhiệm về việc nhập những dữ liệu này và về việc có quyền nhập chúng hay không.
        </p>
        <p>
          Chúng tôi khuyến nghị chỉ nhập lượng thông tin tối thiểu đủ để quản lý lịch học, ví dụ tên
          gọi hoặc biệt danh, và tránh nhập thông tin nhạy cảm không cần thiết.
        </p>
      </Section>

      <Section title="12. Thay đổi chính sách">
        <p>
          Nội dung trang này có thể được cập nhật khi chức năng của ứng dụng thay đổi. Ngày cập nhật
          gần nhất được ghi ở đầu trang.
        </p>
      </Section>

      <Section title="13. Liên hệ">
        <p>
          Nếu bạn có câu hỏi về chính sách này hoặc muốn yêu cầu xóa dữ liệu, hãy liên hệ:{" "}
          <ContactEmail />
        </p>
      </Section>
    </LegalPage>
  );
}
