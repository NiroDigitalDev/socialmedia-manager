"use client";

import { use } from "react";
import { GenerateFlow } from "@/components/generate/generate-flow";

export default function ProjectGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <GenerateFlow projectId={id} />;
}
