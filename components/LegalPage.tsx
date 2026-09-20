import Link from "next/link";
import React from "react";
import { APP_NAME, LAST_UPDATED, PRIVACY_CONTACT_EMAIL, hasContactEmail } from "./legal-config";

/** Shared chrome for the public legal pages. Server components with no auth
 *  and no client state — they must render for logged-out visitors and for
 *  Meta's reviewers. Reading width is capped around 768px, wider than the
 *  app's phone shell, because these are documents rather than app screens. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 font-bold text-indigo-700 transition hover:bg-white"
        >
          <span aria-hidden>←</span>Quay lại ứng dụng
        </Link>

        <header className="rounded-[28px] bg-gradient-to-br from-indigo-600 to-purple-600 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-indigo-200">{APP_NAME}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-indigo-100">{intro}</p>
          <p className="mt-4 text-xs text-indigo-200">Cập nhật lần cuối: {LAST_UPDATED}</p>
        </header>

        <main className="mt-5 space-y-5 sm:mt-7 sm:space-y-6">{children}</main>

        <footer className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
          <p className="font-bold text-slate-700">{APP_NAME}</p>
          <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center px-2 hover:text-indigo-700 hover:underline">
              Chính sách quyền riêng tư
            </Link>
            <span aria-hidden className="text-slate-300">·</span>
            <Link href="/data-deletion" className="inline-flex min-h-[44px] items-center px-2 hover:text-indigo-700 hover:underline">
              Xóa dữ liệu
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-extrabold text-indigo-700">
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Renders the support address, or an honest placeholder while it is unset —
 *  never a fabricated mailto. */
export function ContactEmail() {
  if (!hasContactEmail) {
    return (
      <span className="rounded-lg bg-amber-50 px-2 py-1 text-sm font-bold text-amber-800">
        [chưa cấu hình địa chỉ hỗ trợ]
      </span>
    );
  }
  return (
    <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="break-all font-bold text-indigo-600 hover:underline">
      {PRIVACY_CONTACT_EMAIL}
    </a>
  );
}

/** Shown to the owner (and to reviewers) when the contact address is missing,
 *  so an unfinished page cannot quietly ship looking complete. */
export function ContactMissingNotice() {
  if (hasContactEmail) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
      <b>Chưa cấu hình địa chỉ hỗ trợ.</b> Hãy đặt <code className="rounded bg-amber-100 px-1">PRIVACY_CONTACT_EMAIL</code>{" "}
      trong <code className="rounded bg-amber-100 px-1">components/legal-config.ts</code> trước khi phát hành và trước khi
      gửi đường dẫn này cho Meta.
    </div>
  );
}
