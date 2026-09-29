"use client";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { Plus } from "lucide-react";
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
    <div>
      {/* Trigger button - collapses away as the panel opens */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden pt-1 -mt-1">
          <div
            inert={open || undefined}
            className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
              open ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0 delay-100"
            }`}
          >
            <Button onClick={() => setOpen(true)} icon={<Plus size={16} />}>
              사원 추가
            </Button>
          </div>
        </div>
      </div>

      {/* Form panel - grows open via a 0fr -> 1fr grid-template-rows
       * transition, since animating to/from an unknown content height
       * needs the browser to size the track, not a guessed pixel value. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            inert={!open || undefined}
            className={`bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 space-y-4 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
              open ? "opacity-100 translate-y-0 delay-100" : "opacity-0 -translate-y-1"
            }`}
          >
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
          </div>
        </div>
      </div>
    </div>
  );
}
