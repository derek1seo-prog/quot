"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shared delete logic for a quote, used by both the desktop table row and
 * the mobile card so the confirm/fetch/refresh behavior stays in one place. */
export function useDeleteQuote(quoteId: string, quoteNumber: string) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`${quoteNumber} 견적을 삭제할까요?`)) return;
    setDeleting(true);
    await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
    router.refresh();
  }

  return { deleting, handleDelete };
}
