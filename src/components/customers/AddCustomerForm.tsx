"use client";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { formatNumber } from "@/lib/format";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Trucking-rate input: raw digits while focused, comma-formatted at rest -
 * matches RateCell/ExchangeRateEditor, since a native number input can't
 * display commas (browsers strip non-digit characters from its value). */
function TruckingRateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldGroup>
      <FieldLabel hint="선택">{label}</FieldLabel>
      <Input
        type="text"
        inputMode="numeric"
        className="text-right"
        value={focused ? value : value !== "" ? formatNumber(Number(value)) : ""}
        onFocus={(e) => {
          const el = e.target;
          setFocused(true);
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => setFocused(false)}
      />
    </FieldGroup>
  );
}

export function AddCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [incheon20ft, setIncheon20ft] = useState("");
  const [incheon40hq, setIncheon40hq] = useState("");
  const [busan20ft, setBusan20ft] = useState("");
  const [busan40hq, setBusan40hq] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setContactName("");
    setPhone("");
    setIncheon20ft("");
    setIncheon40hq("");
    setBusan20ft("");
    setBusan40hq("");
  }

  async function handleSubmit() {
    if (!name) return;
    setSubmitting(true);
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactName,
          phone,
          incheonTruckingRate20ft: incheon20ft === "" ? undefined : Number(incheon20ft),
          incheonTruckingRate40hq: incheon40hq === "" ? undefined : Number(incheon40hq),
          busanTruckingRate20ft: busan20ft === "" ? undefined : Number(busan20ft),
          busanTruckingRate40hq: busan40hq === "" ? undefined : Number(busan40hq),
        }),
      });
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} icon={<Plus size={16} />}>
        화주 추가
      </Button>
    );
  }

  return (
    <div className="bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup>
          <FieldLabel>화주</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel hint="선택">담당자</FieldLabel>
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </FieldGroup>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[var(--foreground)] mb-2">내륙운송료 (KRW)</p>
        <div className="grid grid-cols-2 gap-3">
          <TruckingRateField label="인천항 20FT" value={incheon20ft} onChange={setIncheon20ft} />
          <TruckingRateField label="인천항 40HQ" value={incheon40hq} onChange={setIncheon40hq} />
          <TruckingRateField label="부산항 20FT" value={busan20ft} onChange={setBusan20ft} />
          <TruckingRateField label="부산항 40HQ" value={busan40hq} onChange={setBusan40hq} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || !name}>
          저장
        </Button>
      </div>
    </div>
  );
}
