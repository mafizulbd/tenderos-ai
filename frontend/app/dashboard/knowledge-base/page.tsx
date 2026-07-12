"use client";

import { KnowledgeBasePanel } from "../../components/KnowledgeBasePanel";
import { useApp } from "../../context/AppContext";

export default function KnowledgeBasePage() {
  const { token } = useApp();
  return <KnowledgeBasePanel token={token} />;
}
