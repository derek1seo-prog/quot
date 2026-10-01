"use client";

import { Button } from "@/components/ui/Button";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddSalesRepForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
  }

  function handleCancel() {
    reset();
    setOpen(false);
  }

  async function handleSubmit() {
    if (!name) return;
    setSubmitting(true);
    try {
      await fetch("/api/sales-reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CollapsiblePanel open={open} onTrigger={() => setOpen(true)} triggerLabel="사원 추가">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup>
          <FieldLabel>이름</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김태현 대리" />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel hint="선택">이메일</FieldLabel>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="예: thkim@isseaair.com" />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel hint="선택">전화번호</FieldLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 010-2390-7089" />
        </FieldGroup>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={handleCancel}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || !name}>
          저장
        </Button>
      </div>
    </CollapsiblePanel>
  );
}
