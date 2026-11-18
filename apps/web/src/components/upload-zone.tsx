"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, LoaderCircle, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

export function UploadZone() {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      return api("/uploads", { method: "POST", body: form });
    },
    onSuccess: () => { setFiles([]); void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });
  return (
    <section id="upload" className="upload-strip" aria-labelledby="upload-title">
      <div><span className="section-kicker">ورودی پردازش</span><h2 id="upload-title">سندهای آزمون را وارد کنید</h2><p>PDF متنی، اسکن‌شده یا DOCX تا ۱۰۰ مگابایت</p></div>
      <button className="drop-target" type="button" onClick={() => input.current?.click()}>
        <UploadCloud size={24} /><span>{files.length ? `${files.length} فایل آماده ارسال` : "انتخاب چند فایل"}</span>
      </button>
      <input ref={input} hidden multiple type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
      <button className="primary-button" type="button" disabled={!files.length || upload.isPending} onClick={() => upload.mutate()}>
        {upload.isPending ? <LoaderCircle className="spin" size={18} /> : <FileUp size={18} />} بارگذاری و ثبت
      </button>
      {upload.error && <p className="inline-error" role="alert">{upload.error.message}</p>}
    </section>
  );
}
