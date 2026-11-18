export type JobStatus = "pending" | "queued" | "processing" | "completed" | "failed" | "cancelled";
export type ReviewStatus = "needs_review" | "approved" | "rejected";

export interface DocumentRecord {
  id: string; title: string; kind: string; status: JobStatus; page_count: number;
  dominant_language: string | null; confidence: number; normalized_payload: Record<string, number>;
  created_at: string; updated_at: string;
}
export interface PageRecord {
  id: string; page_number: number; width: number; height: number; normalized_text: string;
  layout_json: { blocks?: Array<{ text: string; box: [number, number, number, number]; confidence: number }> };
  is_scanned: boolean; is_low_quality: boolean; column_count: number; confidence: number; preview_url: string | null;
}
export interface OptionRecord { id: string; label: string; position: number; raw_text: string; normalized_text: string; confidence: number }
export interface QuestionRecord {
  id: string; document_id: string; page_id: string | null; question_number: number;
  question_type: "multiple_choice" | "descriptive"; raw_text: string; normalized_text: string;
  correct_option: string | null; explanation: string | null; tags: string[];
  bounding_box: { x0: number; y0: number; x1: number; y1: number } | null;
  confidence: number; review_status: ReviewStatus; version: number; options: OptionRecord[];
}
export interface Paginated<T> { items: T[]; total: number; page: number; page_size: number }
export interface ProcessingLog { id: string; stage: string; level: string; message: string; payload: Record<string, unknown>; created_at: string }
