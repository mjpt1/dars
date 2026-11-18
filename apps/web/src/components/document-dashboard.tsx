"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpLeft, FileText, LoaderCircle, Play, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { api } from "@/lib/api";
import type { DocumentRecord, Paginated } from "@/lib/types";

const labels: Record<string, string> = { pending: "در انتظار", queued: "در صف", processing: "در حال پردازش", completed: "آماده بازبینی", failed: "ناموفق", cancelled: "لغوشده" };

export function DocumentDashboard() {
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const client = useQueryClient();
  const documents = useQuery({
    queryKey: ["documents", query],
    queryFn: () => api<Paginated<DocumentRecord>>(`/documents?page_size=50&query=${encodeURIComponent(query)}`),
    refetchInterval: (state) => state.state.data?.items.some((item) => ["queued", "processing"].includes(item.status)) ? 3000 : false,
  });
  const process = useMutation({ mutationFn: (id: string) => api(`/documents/${id}/process`, { method: "POST" }), onSuccess: () => void client.invalidateQueries({ queryKey: ["documents"] }) });
  const items = documents.data?.items ?? [];
  const complete = items.filter((item) => item.status === "completed").length;
  const suspicious = items.filter((item) => item.status === "completed" && item.confidence < .75).length;
  return <>
    <header className="page-header"><div><span className="section-kicker">مرکز اسناد</span><h1>صف پردازش و بازبینی</h1><p>وضعیت استخراج، کیفیت تشخیص و آماده‌سازی داده را از یک‌جا مدیریت کنید.</p></div><div className="header-date">امروز<br/><b>۱۸ مرداد ۱۴۰۵</b></div></header>
    <section className="metric-row" aria-label="خلاصه وضعیت">
      <div><FileText/><span>کل اسناد<b>{documents.data?.total ?? 0}</b></span></div>
      <div><ShieldCheck/><span>آماده بازبینی<b>{complete}</b></span></div>
      <div><TriangleAlert/><span>نیازمند توجه<b>{suspicious}</b></span></div>
    </section>
    <section className="table-section">
      <div className="table-toolbar"><div><h2>اسناد اخیر</h2><span>{items.length} مورد نمایش داده می‌شود</span></div><label className="search-box"><Search size={17}/><span className="sr-only">جست‌وجوی سند</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام سند را جست‌وجو کنید"/></label></div>
      {documents.isLoading && <div className="state-message"><LoaderCircle className="spin"/> در حال دریافت اسناد</div>}
      {documents.error && <div className="state-message error" role="alert">دریافت اسناد انجام نشد: {documents.error.message}</div>}
      {!documents.isLoading && !items.length && <div className="empty-state"><FileText/><h3>هنوز سندی ثبت نشده است</h3><p>اولین فایل آزمون را از بخش بارگذاری پایین صفحه وارد کنید.</p></div>}
      {!!items.length && <div className="table-scroll"><table><thead><tr><th>سند</th><th>نوع</th><th>وضعیت</th><th>صفحه / سؤال</th><th>اطمینان</th><th><span className="sr-only">عملیات</span></th></tr></thead><tbody>{items.map((document) => <tr key={document.id}>
        <td><b>{document.title}</b><small>{new Date(document.created_at).toLocaleDateString("fa-IR")}</small></td><td><span className="file-chip">{document.kind.replace("pdf_", "PDF ").toUpperCase()}</span></td><td><span className={`status status-${document.status}`}><i/>{labels[document.status]}</span></td><td>{document.page_count} صفحه <small>{document.normalized_payload.question_count ?? 0} سؤال</small></td><td><span className="confidence"><i style={{width:`${document.confidence*100}%`}}/>{Math.round(document.confidence*100)}٪</span></td><td>{["pending","failed"].includes(document.status) ? <button title="شروع پردازش" className="icon-button" onClick={() => process.mutate(document.id)} disabled={process.isPending}><Play size={18}/></button> : document.status === "completed" ? <Link title="باز کردن میز بازبینی" className="icon-button" href={`/documents/${document.id}`}><ArrowUpLeft size={18}/></Link> : <LoaderCircle className="spin muted" size={18}/>}</td>
      </tr>)}</tbody></table></div>}
    </section>
  </>;
}
