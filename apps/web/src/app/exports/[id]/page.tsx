"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function ExportPage() {
  const { id } = useParams<{id:string}>();
  const job = useQuery({ queryKey:["export",id], queryFn:()=>api<{status:string;record_count:number;download_url:string|null;error_message:string|null}>(`/exports/${id}`), refetchInterval:(q)=>["queued","processing"].includes(q.state.data?.status??"")?1500:false });
  return <div className="full-state">{job.data?.status === "completed" && job.data.download_url ? <><Download size={40}/><h1>خروجی آماده است</h1><p>{job.data.record_count} سؤال در بسته خروجی قرار گرفت.</p><a className="primary-button" href={job.data.download_url}>دریافت فایل</a></> : job.data?.status === "failed" ? <><h1>ساخت خروجی ناموفق بود</h1><p className="inline-error">{job.data.error_message}</p></> : <><LoaderCircle className="spin"/><h1>در حال ساخت خروجی</h1><p>JSON، CSV و فایل manifest در حال آماده‌سازی است.</p></>}</div>;
}