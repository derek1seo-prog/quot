"use client";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name) return;
    setSubmitting(true);
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactName, email, phone }),
      });
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} icon={<Plus size={16} />}>
        고객 추가
      </Button>
    );
  }

  return (
    <div className="grid sm:grid-cols-4 gap-3 items-end bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4">
      <FieldGroup>
        <FieldLabel>고객명</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel hint="선택">담당자</FieldLabel>
        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel hint="선택">이메일</FieldLabel>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
      </FieldGroup>
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting || !name}>
          저장
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </div>
  );
}
