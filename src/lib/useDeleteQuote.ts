"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shared delete logic for a quote, used by both the desktop table row and
 * the mobile card so the confirm/fetch/refresh behavior stays in one place.
 * `confirmOpen` drives a <ConfirmDialog/> the caller renders itself - this
 * hook only owns the state, not the JSX. */
export function useDeleteQuote(quoteId: string, quoteNumber: string) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function requestDelete() {
    setConfirmOpen(true);
  }

  function cancelDelete() {
    setConfirmOpen(false);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return { deleting, confirmOpen, quoteNumber, requestDelete, cancelDelete, confirmDelete };
}
