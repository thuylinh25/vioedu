import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContactEmail, ContactMissingNotice, LegalPage, Section } from "@/components/LegalPage";
import { APP_NAME, GOVERNING_LAW } from "@/components/legal-config";

export const metadata: Metadata = {
  title: `Điều khoản sử dụng | ${APP_NAME}`,
  description: `Điều khoản sử dụng ứng dụng ${APP_NAME}.`,
};

const governingLaw = GOVERNING_LAW.trim();

export default function TermsPage() {
  return (
    <LegalPage
      title="Điều khoản sử dụng"
      intro={`Điều khoản này mô tả quyền và trách nhiệm của bạn khi dùng ${APP_NAME}. Vui lòng đọc trước khi sử dụng.`}
    >
      <ContactMissingNotice />

      <Section title="1. Chấp nhận điều khoản">
        <p>
          Khi tạo tài khoản hoặc sử dụng {APP_NAME}, bạn đồng ý với các điều khoản trên trang này.
          Nếu bạn không đồng ý, vui lòng không sử dụng ứng dụng.
        </p>
      </Section>

      <Section title="2. Dịch vụ là gì">
        <p>
          {APP_NAME} là ứng dụng giúp bạn quản lý lịch học theo nhóm: tạo nhóm, thêm học sinh, lên
          lịch học và đánh dấu buổi học đã hoàn thành.
        </p>
        <p>
          Ứng dụng hiện được cung cấp <b>miễn phí</b>. Chúng tôi không thu phí, không bán hàng trong
          ứng dụng và không hiển thị quảng cáo.
        </p>
        <p>
          {APP_NAME} là một công cụ ghi chép lịch học. Ứng dụng không phải là nền tảng giảng dạy,
          không cung cấp nội dung học tập và không có liên kết chính thức với bất kỳ tổ chức giáo dục
          nào.
        </p>
      </Section>

      <Section title="3. Tài khoản">
        <Bullets
          items={[
            "Bạn cần đăng nhập bằng email và mật khẩu, hoặc bằng tài khoản Google hay Facebook, để sử dụng ứng dụng.",
            "Bạn chịu trách nhiệm giữ an toàn cho thông tin đăng nhập của mình.",
            "Bạn chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của mình.",
            "Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy đổi mật khẩu và liên hệ với chúng tôi.",
          ]}
        />
      </Section>

      <Section title="4. Nội dung bạn nhập vào ứng dụng">
        <p>
          Bạn tự nhập tên nhóm, tên học sinh và lịch học. Những dữ liệu này thuộc về bạn, và bạn có
          thể sửa hoặc xóa bất kỳ lúc nào trong ứng dụng.
        </p>
        <p>
          Vì ứng dụng dùng để quản lý lịch học của người khác — thường là con em hoặc học sinh —{" "}
          <b>bạn chịu trách nhiệm về việc mình có quyền nhập những thông tin đó hay không</b>, và về
          tính chính xác của chúng. Chúng tôi khuyến nghị chỉ nhập lượng thông tin tối thiểu cần thiết,
          ví dụ tên gọi hoặc biệt danh.
        </p>
        <p>
          Cách chúng tôi xử lý dữ liệu này được mô tả trong{" "}
          <Link href="/privacy" className="font-bold text-indigo-600 hover:underline">
            Chính sách quyền riêng tư
          </Link>
          .
        </p>
      </Section>

      <Section title="5. Những việc không được làm">
        <p>Khi sử dụng {APP_NAME}, bạn đồng ý không:</p>
        <Bullets
          items={[
            "Sử dụng ứng dụng cho mục đích vi phạm pháp luật.",
            "Cố truy cập tài khoản, nhóm hoặc dữ liệu của người khác.",
            "Dò tìm, khai thác lỗ hổng hoặc can thiệp vào hoạt động bình thường của hệ thống.",
            "Dùng công cụ tự động để tạo tài khoản hàng loạt hoặc gửi lượng truy cập bất thường.",
            "Nhập nội dung xúc phạm, bôi nhọ hoặc vi phạm quyền riêng tư của người khác.",
          ]}
        />
      </Section>

      <Section title="6. Tính sẵn sàng của dịch vụ">
        <p>
          Ứng dụng được cung cấp theo hiện trạng. Chúng tôi cố gắng để dịch vụ hoạt động ổn định
          nhưng <b>không cam kết ứng dụng luôn sẵn sàng, không gián đoạn hay không có lỗi</b>. Dịch
          vụ có thể tạm ngừng để bảo trì, hoặc do sự cố từ các nhà cung cấp hạ tầng mà chúng tôi sử
          dụng.
        </p>
        <p>
          Chúng tôi có thể thay đổi, tạm ngừng hoặc ngừng hẳn một phần hay toàn bộ chức năng. Nếu có
          thay đổi lớn ảnh hưởng đến dữ liệu của bạn, chúng tôi sẽ cố gắng thông báo trước qua ứng
          dụng hoặc email.
        </p>
      </Section>

      <Section title="7. Sao lưu dữ liệu">
        <p>
          Thao tác xóa nhóm, học sinh hoặc lịch học là <b>không thể hoàn tác</b>. Ứng dụng không có
          thùng rác và không cung cấp dịch vụ khôi phục dữ liệu cho từng người dùng.
        </p>
        <p>
          Nếu dữ liệu lịch học quan trọng với bạn, hãy tự lưu lại một bản ở nơi khác.
        </p>
      </Section>

      <Section title="8. Giới hạn trách nhiệm">
        <p>
          Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm cho những thiệt hại gián
          tiếp phát sinh từ việc sử dụng ứng dụng, ví dụ buổi học bị bỏ lỡ do ứng dụng không truy cập
          được, hoặc dữ liệu bị mất do thao tác xóa.
        </p>
        <p>
          {APP_NAME} là công cụ hỗ trợ ghi nhớ, không thay thế cho việc bạn tự theo dõi lịch học của
          mình.
        </p>
      </Section>

      <Section title="9. Tạm ngừng và chấm dứt">
        <p>
          Bạn có thể ngừng sử dụng bất kỳ lúc nào. Để xóa tài khoản và dữ liệu, xem{" "}
          <Link href="/data-deletion" className="font-bold text-indigo-600 hover:underline">
            hướng dẫn xóa dữ liệu
          </Link>
          .
        </p>
        <p>
          Chúng tôi có thể tạm ngừng hoặc chấm dứt quyền truy cập của một tài khoản nếu tài khoản đó
          vi phạm nghiêm trọng các điều khoản ở mục 5, hoặc gây ảnh hưởng đến người dùng khác.
        </p>
      </Section>

      <Section title="10. Dịch vụ của bên thứ ba">
        <p>
          Ứng dụng sử dụng Supabase cho phần xác thực và cơ sở dữ liệu, và cho phép đăng nhập bằng
          Google hoặc Facebook. Khi bạn chọn đăng nhập bằng một nhà cung cấp, điều khoản và chính sách
          riêng tư của nhà cung cấp đó cũng được áp dụng cho phần họ xử lý.
        </p>
        <p>
          Ứng dụng có liên kết dẫn tới website vio.edu.vn. Chúng tôi không sở hữu, không vận hành và
          không chịu trách nhiệm về nội dung của website đó.
        </p>
      </Section>

      <Section title="11. Thay đổi điều khoản">
        <p>
          Chúng tôi có thể cập nhật điều khoản khi chức năng ứng dụng thay đổi. Ngày cập nhật gần nhất
          được ghi ở đầu trang. Việc bạn tiếp tục sử dụng ứng dụng sau khi điều khoản được cập nhật
          đồng nghĩa với việc bạn chấp nhận nội dung mới.
        </p>
      </Section>

      {governingLaw && (
        <Section title="12. Luật áp dụng">
          <p>Điều khoản này được điều chỉnh bởi {governingLaw}.</p>
        </Section>
      )}

      <Section title={governingLaw ? "13. Liên hệ" : "12. Liên hệ"}>
        <p>
          Nếu bạn có câu hỏi về điều khoản này, hãy liên hệ: <ContactEmail />
        </p>
      </Section>
    </LegalPage>
  );
}
