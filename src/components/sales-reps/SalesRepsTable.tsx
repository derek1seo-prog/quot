"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import type { SalesRep } from "@/lib/types";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

// Column widths as percentages of the table (name/email/phone sum to 100),
// plus a fixed-px actions column - table-fixed makes these exact regardless
// of content, so switching a cell between plain text and an <Input> never
// resizes the column (which is what actually read as "jerky" - not the
// transition, the layout shift underneath it).
const nameColPct = 25;
const emailColPct = 45;
const phoneColPct = 30;
const actionColWidth = 80; // px - fits the two same-sized icon buttons in either state

export function SalesRepsTable({ initialSalesReps }: { initialSalesReps: SalesRep[] }) {
  const [salesReps, setSalesReps] = useState(initialSalesReps);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; email: string; phone: string }>({
    name: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesRep | null>(null);

  // initialSalesReps is a fresh array from the server component on every
  // router.refresh() (e.g. after adding a rep) - without this, state above
  // stays frozen at its first-mount value. Adjusting state during render
  // per React's guidance for syncing state to a changed prop.
  const [prevInitialSalesReps, setPrevInitialSalesReps] = useState(initialSalesReps);
  if (initialSalesReps !== prevInitialSalesReps) {
    setPrevInitialSalesReps(initialSalesReps);
    setSalesReps(initialSalesReps);
  }

  function startEdit(rep: SalesRep) {
    setEditingId(rep.id);
    setDraft({ name: rep.name, email: rep.email ?? "", phone: rep.phone ?? "" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/sales-reps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: draft.name, email: draft.email, phone: draft.phone }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = (await res.json()) as SalesRep;
      setSalesReps((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const rep = pendingDelete;
    if (!rep) return;
    setDeletingId(rep.id);
    try {
      await fetch(`/api/sales-reps?id=${rep.id}`, { method: "DELETE" });
      setSalesReps((prev) => prev.filter((r) => r.id !== rep.id));
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  if (salesReps.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-16 text-center text-[var(--muted)] text-[14px]">
          등록된 사원이 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col style={{ width: `${nameColPct}%` }} />
          <col style={{ width: `${emailColPct}%` }} />
          <col style={{ width: `${phoneColPct}%` }} />
          <col style={{ width: `${actionColWidth}px` }} />
        </colgroup>
        <thead>
          <tr className="text-[12px] text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border-subtle)]">
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-3 py-3 font-medium">이메일</th>
            <th className="px-3 py-3 font-medium">전화번호</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {salesReps.map((r) => {
            const editing = editingId === r.id;
            return (
              <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 group">
                <td className="px-4 py-2.5 align-middle text-[13.5px] font-medium truncate">
                  {editing ? (
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle text-[13.5px] text-[var(--foreground)] truncate">
                  {editing ? (
                    <Input
                      value={draft.email}
                      onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    r.email ?? "-"
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle text-[13.5px] text-[var(--foreground)] truncate">
                  {editing ? (
                    <Input
                      value={draft.phone}
                      onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    r.phone ?? "-"
                  )}
                </td>
                <td className="px-2 align-middle text-right whitespace-nowrap">
                  {editing ? (
                    <>
                      <button
                        onClick={() => saveEdit(r.id)}
                        disabled={saving || !draft.name}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--success)] hover:bg-[var(--accent-soft)]"
                        aria-label="저장"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
                        aria-label="취소"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(r)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        aria-label="수정"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(r)}
                        disabled={deletingId === r.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
                        aria-label="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={pendingDelete != null}
        title="사원을 삭제할까요?"
        description={
          pendingDelete ? `${pendingDelete.name} 정보가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.` : undefined
        }
        loading={deletingId != null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  );
}
