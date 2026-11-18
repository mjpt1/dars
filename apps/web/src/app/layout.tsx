import type { Metadata } from "next";
import Link from "next/link";
import { Database, FileSearch, UploadCloud } from "lucide-react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = { title: "سازنده بانک آزمون", description: "استخراج، بازبینی و خروجی داده‌های آزمون" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Providers>
          <div className="app-shell">
            <aside className="sidebar">
              <Link className="brand" href="/" aria-label="صفحه اصلی سازنده بانک آزمون">
                <span className="brand-mark"><FileSearch size={22} /></span>
                <span><b>داده‌ساز آزمون</b><small>میز پردازش اسناد</small></span>
              </Link>
              <nav aria-label="ناوبری اصلی">
                <Link href="/"><Database size={18} /> اسناد</Link>
                <Link href="/#upload"><UploadCloud size={18} /> بارگذاری</Link>
              </nav>
              <div className="sidebar-foot"><span className="live-dot" /> سرویس پردازش آماده</div>
            </aside>
            <main className="main-content">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}