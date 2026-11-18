"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Download, FileWarning, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DocumentRecord, PageRecord, Paginated, ProcessingLog, QuestionRecord } from "@/lib/types";

export function ReviewWorkspace({ documentId }: { documentId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const document = useQuery({ queryKey: ["document", documentId], queryFn: () => api<DocumentRecord>(`/documents/${documentId}`) });
  const pages = useQuery({ queryKey: ["pages", documentId], queryFn: () => api<PageRecord[]>(`/documents/${documentId}/pages`) });
  const questions = useQuery({ queryKey: ["questions", documentId], queryFn: () => api<Paginated<QuestionRecord>>(`/questions?document_id=${documentId}&page_size=100`) });
  const logs = useQuery({ queryKey: ["logs", documentId], queryFn: () => api<ProcessingLog[]>(`/documents/${documentId}/logs`) });
  const current = questions.data?.items.find((item) => item.id === selected) ?? questions.data?.items[0];
  useEffect(() => { if (current) { setText(current.normalized_text); setAnswer(current.correct_option ?? ""); } }, [current]);
  const refresh = () => void client.invalidateQueries({ queryKey: ["questions", documentId] });
  const save = useMutation({ mutationFn: () => api(`/questions/${current?.id}`, { method: "PATCH", body: JSON.stringify({ normalized_text: text, correct_option: answer || null, expected_version: current?.version }) }), onSuccess: refresh });
  const review = useMutation({ mutationFn: (status: "approve"|"reject") => api(`/questions/${current?.id}/${status}`, { method: "POST", body: JSON.stringify({}) }), onSuccess: refresh });
  const exportData = useMutation({ mutationFn: () => api<{id:string}>("/exports", { method: "POST", body: JSON.stringify({ format: "zip", document_id: documentId }) }), onSuccess: (job) => window.location.assign(`/exports/${job.id}`) });
  const currentPage = pages.data?.[pageIndex];
  if (document.isLoading || pages.isLoading || questions.isLoading) return <div className="full-state"><LoaderCircle className="spin"/> در حال آماده‌سازی میز بازبینی</div>;
  if (document.error || pages.error || questions.error) return <div className="full-state error">بارگذاری میز بازبینی انجام نشد.</div>;
  return <div className="review-page">
    <header className="review-header"><div><span className="section-kicker">میز بازبینی سند</span><h1>{document.data?.title}</h1></div><div className="review-actions"><span>{questions.data?.total ?? 0} سؤال</span><button className="secondary-button" onClick={() => exportData.mutate()}><Download size={17}/> خروجی ZIP</button></div></header>
    <div className="review-grid">
      <aside className="question-rail"><div className="rail-title">فهرست سؤال‌ها <span>{questions.data?.items.filter(q=>q.review_status==="needs_review").length} بررسی‌نشده</span></div>{questions.data?.items.map((question) => <button key={question.id} className={question.id === current?.id ? "active" : ""} onClick={() => setSelected(question.id)}><b>{question.question_number}</b><span>{question.normalized_text}</span><i className={`review-dot ${question.review_status}`}/></button>)}</aside>
      <section className="document-viewer"><div className="viewer-toolbar"><button title="صفحه قبل" disabled={pageIndex===0} onClick={()=>setPageIndex(v=>v-1)}><ChevronRight/></button><span>صفحه {currentPage?.page_number ?? 0} از {pages.data?.length ?? 0}</span><button title="صفحه بعد" disabled={pageIndex===(pages.data?.length??1)-1} onClick={()=>setPageIndex(v=>v+1)}><ChevronLeft/></button></div><div className="page-canvas">{currentPage?.preview_url ? <img src={currentPage.preview_url} alt={`پیش‌نمایش صفحه ${currentPage.page_number}`}/> : <pre>{currentPage?.normalized_text}</pre>}{current?.bounding_box && current.page_id===currentPage?.id && <div className="bbox" style={{right:`${(current.bounding_box.x0/currentPage.width)*100}%`,top:`${(current.bounding_box.y0/currentPage.height)*100}%`,width:`${((current.bounding_box.x1-current.bounding_box.x0)/currentPage.width)*100}%`,height:`${((current.bounding_box.y1-current.bounding_box.y0)/currentPage.height)*100}%`}}/>}</div></section>
      <section className="editor-panel">{current ? <><div className="editor-heading"><div><span>سؤال {current.question_number}</span><b className={current.confidence<.7?"low":""}>{Math.round(current.confidence*100)}٪ اطمینان</b></div>{current.confidence<.7 && <FileWarning size={20}/>}</div><label>متن نرمال‌شده<textarea rows={8} value={text} onChange={e=>setText(e.target.value)}/></label><div className="options-editor"><span>گزینه‌های استخراج‌شده</span>{current.options.map(option=><div key={option.id}><b>{option.label}</b><p>{option.normalized_text}</p></div>)}</div><label>پاسخ صحیح<input value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="مثلاً ۲ یا ب"/></label><div className="editor-buttons"><button className="secondary-button" onClick={()=>save.mutate()} disabled={save.isPending}><Save size={17}/> ذخیره</button><button className="approve-button" onClick={()=>review.mutate("approve")}><Check size={18}/> تأیید</button><button className="reject-button" title="رد سؤال" onClick={()=>review.mutate("reject")}><X size={18}/></button></div>{(save.error||review.error)&&<p className="inline-error">ثبت تغییر انجام نشد.</p>}</> : <div className="empty-state">سؤالی برای بازبینی پیدا نشد.</div>}</section>
    </div>
    <details className="process-log"><summary>گزارش مراحل پردازش ({logs.data?.length ?? 0})</summary>{logs.data?.map(log=><p key={log.id}><time>{new Date(log.created_at).toLocaleTimeString("fa-IR")}</time><b>{log.stage}</b>{log.message}</p>)}</details>
  </div>;
}
