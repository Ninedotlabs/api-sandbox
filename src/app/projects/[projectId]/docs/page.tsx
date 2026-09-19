import { redirect } from "next/navigation";

export default async function DocsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/reference`);
}
