import { ReviewWorkspace } from "@/components/review-workspace";

export default async function DocumentPage({ params }: { params: Promise<{id:string}> }) { const { id } = await params; return <ReviewWorkspace documentId={id}/>; }
