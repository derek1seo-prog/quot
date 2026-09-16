"use client";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { formatNumber } from "@/lib/format";
import type { ExchangeRate } from "@/lib/types";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

export function ExchangeRateEditor({ initial }: { initial: ExchangeRate }) {
  const [rate, setRate] = useState(String(initial.rate));
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [asOf, setAsOf] = useState(initial.asOf);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/rates/exchange", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: Number(rate), asOf }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid sm:grid-cols-3 gap-4 items-end max-w-xl">
      <FieldGroup>
        <FieldLabel>USD → KRW 환율</FieldLabel>
        <Input
          type="text"
          inputMode="numeric"
          className="text-right"
          value={focused ? rate : rate !== "" ? formatNumber(Number(rate)) : ""}
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => setFocused(false)}
        />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>기준일</FieldLabel>
        <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </FieldGroup>
      <Button
        onClick={handleSave}
        disabled={saving}
        icon={saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : undefined}
      >
        {saving ? "저장 중..." : saved ? "저장됨" : "환율 저장"}
      </Button>
    </div>
  );
}
