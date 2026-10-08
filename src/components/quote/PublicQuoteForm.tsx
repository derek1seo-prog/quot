"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { CustomerCombobox } from "./CustomerCombobox";
import { IncotermsSelect } from "./IncotermsSelect";
import { PortCombobox, type PortOption } from "./PortCombobox";
import { QuoteDocument } from "./QuoteDocument";
import { QuoteResultSkeleton } from "./QuoteResultSkeleton";
import { SalesRepCombobox } from "./SalesRepCombobox";
import { endOfMonthIso, todayIso } from "@/lib/format";
import { useDebouncedValue, useRememberedSalesRepId } from "@/lib/hooks";
import type {
  CompanyInfo,
  ContainerType,
  Customer,
  Port,
  QuoteInput,
  QuoteResult,
  Region,
  SalesRep,
} from "@/lib/types";
import { Loader2, Pencil, Printer, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TODAY = todayIso();

// Quick-quote mode has no real customer behind it unless isAdmin (an
// authenticated admin session resolves a real match via CustomerCombobox
// below), so 화주 starts blank for everyone (its placeholder just reads
// "화주명"). 담당자 does get a real default so the printed quote's 수신
// line never starts out blank - still editable (see editingAddressee
// below) for anyone who wants their own name/company to show on a
// printed/PDF'd sample quote.
const DEFAULT_QUICK_CONTACT_NAME = "수입 담당자님";

/** Shared by /quick-quote (and "/" for a non-admin visitor) and /my - a
 * single-screen (not the admin wizard's multi-step) rate-lookup form.
 * Reuses the same functional building blocks as the admin wizard
 * (PortCombobox, IncotermsSelect, QuoteDocument) but never touches that
 * file - quick-quote/customer are a deliberately simpler, separate flow
 * so the existing admin wizard stays completely unchanged. */
export function PublicQuoteForm({
  mode,
  isAdmin = false,
  originPorts,
  destinationPorts,
  regions,
  containerTypes,
  company,
  lockedCustomer,
  preparedBy,
  preparedByEmail,
  preparedByPhone,
  salesReps = [],
  customers = [],
}: {
  mode: "quick" | "customer";
  /** True only for an authenticated admin session using the quick-quote
   * screen (never for an anonymous/guest visitor). Gates the addressee
   * editor's pencil button and swaps 화주 between a plain free-text input
   * and the real CustomerCombobox (auto-fill + rate resolution). The real
   * security boundary is server-side (/api/calculate's session-keyed
   * guard) - this only controls what a person can type. */
  isAdmin?: boolean;
  originPorts: Port[];
  destinationPorts: Port[];
  regions: Region[];
  containerTypes: ContainerType[];
  company: CompanyInfo;
  lockedCustomer?: { name: string; contactName?: string };
  preparedBy?: string;
  preparedByEmail?: string;
  preparedByPhone?: string;
  salesReps?: SalesRep[];
  customers?: Customer[];
}) {
  const router = useRouter();
  const [originPortId, setOriginPortId] = useState("");
  const [destinationPortId, setDestinationPortId] = useState("");
  const [incoterms, setIncoterms] = useState("FOB");
  const [containerTypeId, setContainerTypeId] = useState(containerTypes[0]?.id ?? "");
  const [containerQuantity, setContainerQuantity] = useState(1);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickContactName, setQuickContactName] = useState(DEFAULT_QUICK_CONTACT_NAME);
  const [quickSalesRepId, setQuickSalesRepId, autoFillQuickSalesRepId] = useRememberedSalesRepId(salesReps);
  const [quickValidUntil, setQuickValidUntil] = useState(endOfMonthIso(TODAY));
  // Admin sessions can actually use this editor (auto-fill + rate
  // resolution), so it starts already open for them rather than making
  // every visit start with an extra click just to reach it - isAdmin
  // never changes while this component is mounted, so a plain useState
  // initializer is enough, no effect needed to keep it in sync.
  const [editingAddressee, setEditingAddressee] = useState(isAdmin);
  // The reveal block below needs overflow-hidden while collapsed/animating
  // (so the 0fr->1fr height transition doesn't show spilling content), but
  // that same overflow-hidden clips the 발신 담당자 combobox's dropdown
  // panel (position: absolute, pops out below its input) once the block is
  // fully open. Switch to overflow-visible only once the open animation
  // has actually finished, matching duration-300 below.
  const [addresseeRevealed, setAddresseeRevealed] = useState(false);

  useEffect(() => {
    if (!editingAddressee) {
      requestAnimationFrame(() => setAddresseeRevealed(false));
      return;
    }
    const timer = setTimeout(() => setAddresseeRevealed(true), 300);
    return () => clearTimeout(timer);
  }, [editingAddressee]);

  const quickRep = salesReps.find((r) => r.id === quickSalesRepId);
  const matchedQuickCustomer = isAdmin ? customers.find((c) => c.name === quickCustomerName) : undefined;
  // The live-preview /api/calculate call below only fires on route/
  // incoterms/container changes, not on every keystroke - debounce this
  // one so selecting/typing 화주 (which matters for an admin session's
  // trucking-rate resolution) still triggers a recalculation, without
  // firing a request on every single letter typed.
  const debouncedQuickCustomerName = useDebouncedValue(quickCustomerName, 400);

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Per-quote 단가 overrides an admin session can edit in the live preview
  // below, mirroring the admin wizard's own preview-step mechanism
  // (quotes/new/page.tsx) - keyed by chargeTypeId. Only ever populated
  // when isAdmin (RateCell is never rendered editable otherwise).
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  const [pendingRateEdits, setPendingRateEdits] = useState(0);

  const polOptions: PortOption[] = useMemo(
    () =>
      regions.flatMap((region) => {
        const ports = originPorts.filter((p) => p.regionId === region.id);
        return ports.map((port) => ({ port, groupLabel: region.nameKo }));
      }),
    [originPorts, regions],
  );
  const podOptions: PortOption[] = useMemo(
    () => destinationPorts.map((port) => ({ port })),
    [destinationPorts],
  );

  const originPort = originPorts.find((p) => p.id === originPortId);
  const destinationPort = destinationPorts.find((p) => p.id === destinationPortId);

  function buildInput(overrides: Record<string, number> = rateOverrides): QuoteInput {
    return {
      customerId: mode === "quick" && isAdmin ? matchedQuickCustomer?.id : undefined,
      customerName: mode === "quick" ? quickCustomerName : (lockedCustomer?.name ?? ""),
      contactName: mode === "quick" ? quickContactName : lockedCustomer?.contactName,
      salesRepId: mode === "quick" && isAdmin ? quickSalesRepId : undefined,
      preparedBy: mode === "quick" ? (isAdmin ? (quickRep?.name ?? "") : "") : (preparedBy ?? ""),
      preparedByEmail: mode === "quick" ? (isAdmin ? quickRep?.email : undefined) : preparedByEmail,
      preparedByPhone: mode === "quick" ? (isAdmin ? quickRep?.phone : undefined) : preparedByPhone,
      quoteDate: TODAY,
      validUntil: mode === "quick" ? quickValidUntil : endOfMonthIso(TODAY),
      transportMode: "FCL",
      originCountryId: originPort?.countryId ?? "",
      originPortId,
      destinationCountryId: destinationPort?.countryId ?? "",
      destinationPortId,
      incoterms,
      container: { containerTypeId, quantity: containerQuantity },
      rateOverrides: overrides,
    };
  }

  const ready = Boolean(originPortId && destinationPortId && incoterms && containerTypeId);

  // Live preview - recalculates whenever the lookup conditions change,
  // rather than a separate "조회" button, so changing a condition reads
  // as adjusting a live quote rather than submitting a new query each time.
  useEffect(() => {
    if (!ready) {
      requestAnimationFrame(() => setResult(null));
      return;
    }
    let cancelled = false;
    requestAnimationFrame(() => {
      if (!cancelled) {
        setCalculating(true);
        setError(null);
      }
    });
    fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildInput()),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "계산에 실패했습니다.");
        setResult(data as QuoteResult);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "계산에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setCalculating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPortId, destinationPortId, incoterms, containerTypeId, containerQuantity, debouncedQuickCustomerName]);

  async function handleIssue() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "견적서 발급에 실패했습니다.");
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 발급에 실패했습니다.");
      setSaving(false);
    }
  }

  // Mirrors the admin wizard's own handleRateOverride (quotes/new/page.tsx)
  // exactly - editing a 단가 recalculates through the same /api/calculate
  // engine call as every other field, then commits the override so it
  // persists across later recalculations (route/incoterms/container
  // changes) via buildInput()'s own default param.
  async function handleRateOverride(chargeTypeId: string, rate: number) {
    setPendingRateEdits((n) => n + 1);
    try {
      const next = { ...rateOverrides, [chargeTypeId]: rate };
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput(next)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재계산에 실패했습니다.");
      setRateOverrides(next);
      setResult(data as QuoteResult);
    } finally {
      setPendingRateEdits((n) => n - 1);
    }
  }

  // Admin's 인쇄 in quick-quote records a real quote (unlike an anonymous
  // visitor, who only ever gets an unsaved, ephemeral preview) - save it
  // first, then open the same dedicated print route + autoprint mechanism
  // QuoteActions already uses for every other saved quote, so the printed
  // output and the resulting record are the exact canonical ones, not a
  // one-off local rendering of this page.
  async function handleQuickPrint() {
    if (!isAdmin) {
      window.print();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "견적서 저장에 실패했습니다.");
      window.open(`/quotes/${data.id}/print?autoprint=1`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="space-y-6 no-print">
      <Card className="p-6 sm:p-8">
        {mode === "customer" && lockedCustomer && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6 pb-6 border-b border-[var(--border-subtle)]">
            <FieldGroup>
              <FieldLabel hint="고정">화주명</FieldLabel>
              <Input value={lockedCustomer.name} disabled />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="고정">견적 담당자</FieldLabel>
              <Input value={preparedBy ?? ""} disabled />
            </FieldGroup>
          </div>
        )}

        {mode === "quick" && (
          <div className="-mt-2 -mr-2 mb-1 relative z-10">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditingAddressee((v) => !v)}
                disabled={!isAdmin}
                className="flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-[12px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--muted)]"
                title={isAdmin ? "견적서 수신/발신 정보 수정" : "관리자 로그인 후 이용할 수 있습니다"}
                aria-label="견적서 수신/발신 정보 수정"
                aria-expanded={editingAddressee}
              >
                <Pencil
                  size={13}
                  className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                  style={{ transform: editingAddressee ? "rotate(-25deg) scale(1.05)" : "rotate(0deg)" }}
                />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none ${
                    editingAddressee ? "max-w-[40px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  완료
                </span>
              </button>
            </div>

            {/* Smoothly grows/shrinks via an animated grid-row track (0fr <-> 1fr)
                rather than an instant mount/unmount - the same reveal technique
                already used for the admin wizard's container-type quantity field
                (quotes/new/page.tsx), just applied here to a taller block. */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                editingAddressee ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className={addresseeRevealed ? "overflow-visible" : "overflow-hidden"}>
                <div
                  inert={!editingAddressee || undefined}
                  className={`pt-1 pb-6 mb-5 border-b border-[var(--border-subtle)] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
                    editingAddressee ? "opacity-100 translate-y-0 delay-100" : "opacity-0 -translate-y-1.5"
                  }`}
                >
                  <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">
                    견적서 수신/발신 정보
                  </p>
                  <div className="grid sm:grid-cols-4 gap-4">
                    <FieldGroup>
                      <FieldLabel>화주</FieldLabel>
                      {isAdmin ? (
                        <>
                          <CustomerCombobox
                            value={quickCustomerName}
                            onChange={(name) => {
                              setQuickCustomerName(name);
                              const matched = customers.find((c) => c.name === name);
                              if (matched?.contactName) setQuickContactName(matched.contactName);
                              if (matched?.salesRepId && salesReps.some((r) => r.id === matched.salesRepId)) {
                                autoFillQuickSalesRepId(matched.salesRepId);
                              }
                            }}
                            customers={customers}
                            placeholder="예: 지더블유파트너스"
                          />
                          {matchedQuickCustomer && (
                            <p className="text-[11px] text-[var(--accent)] mt-1.5">
                              ✓ 등록된 화주 정보가 연동되었습니다
                            </p>
                          )}
                        </>
                      ) : (
                        <Input
                          value={quickCustomerName}
                          onChange={(e) => setQuickCustomerName(e.target.value)}
                          placeholder="화주명"
                        />
                      )}
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel>담당자</FieldLabel>
                      <Input
                        value={quickContactName}
                        onChange={(e) => setQuickContactName(e.target.value)}
                        placeholder={DEFAULT_QUICK_CONTACT_NAME}
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel>견적 담당자 (발신)</FieldLabel>
                      <SalesRepCombobox value={quickSalesRepId} onChange={setQuickSalesRepId} options={salesReps} />
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel>유효기간</FieldLabel>
                      <Input
                        type="date"
                        value={quickValidUntil}
                        onChange={(e) => setQuickValidUntil(e.target.value)}
                      />
                    </FieldGroup>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6">
          <FieldGroup>
            <FieldLabel>출발항 (POL)</FieldLabel>
            <PortCombobox value={originPortId} onChange={setOriginPortId} options={polOptions} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>도착항 (POD)</FieldLabel>
            <PortCombobox value={destinationPortId} onChange={setDestinationPortId} options={podOptions} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel hint={mode === "quick" && !isAdmin ? "FOB 고정" : undefined}>선적 조건 (Incoterms)</FieldLabel>
            {mode === "quick" && !isAdmin ? (
              <Input value="FOB" disabled />
            ) : (
              <IncotermsSelect value={incoterms} onChange={setIncoterms} />
            )}
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>컨테이너 타입</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1 flex gap-2">
                {containerTypes.map((ct) => {
                  const selected = ct.id === containerTypeId;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setContainerTypeId(ct.id)}
                      className={`flex-1 h-10 rounded-[var(--radius-sm)] border-2 text-[13.5px] font-semibold transition-toggle-select ${
                        selected
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40"
                      }`}
                    >
                      {ct.label}
                    </button>
                  );
                })}
              </div>
              <Input
                type="number"
                min={1}
                value={containerQuantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setContainerQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 text-center"
              />
            </div>
          </FieldGroup>
        </div>
      </Card>

      {mode === "quick" && !isAdmin && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--accent-soft)]">
          <Badge tone="accent">체험용</Badge>
          <p className="text-[13px] text-[var(--accent)]">
            체험용 견적입니다. 실제 견적은 상이할 수 있습니다.
          </p>
        </div>
      )}

      {calculating && <QuoteResultSkeleton />}

      {!calculating && error && (
        <Card className="p-8 text-center">
          <p className="text-[14px] text-[var(--danger)] font-medium">{error}</p>
        </Card>
      )}

      {!calculating && !error && result && (
        <>
          {mode === "quick" && (
            <div className="flex items-center justify-end gap-3 max-w-[900px] mx-auto">
              {isAdmin && pendingRateEdits > 0 && (
                <span className="text-[12px] text-[var(--muted)] flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> 단가 반영 중...
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleQuickPrint}
                disabled={saving || pendingRateEdits > 0}
                icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              >
                {saving ? "저장 중..." : "인쇄"}
              </Button>
            </div>
          )}
          <QuoteDocument
            company={company}
            quoteNumber={null}
            input={buildInput()}
            result={result}
            originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : ""}
            destinationLabel={destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : ""}
            onRateChange={isAdmin ? handleRateOverride : undefined}
          />
          {isAdmin && mode === "quick" && (
            <p className="text-[12px] text-[var(--muted)] mt-3 text-center max-w-[900px] mx-auto">
              단가를 클릭하면 이 견적만 다른 운임으로 수정할 수 있습니다. 견적가는 자동으로 다시 계산됩니다.
            </p>
          )}
          {mode === "customer" && (
            <div className="flex justify-end max-w-[900px] mx-auto">
              <Button
                onClick={handleIssue}
                disabled={saving}
                icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              >
                {saving ? "발급 중..." : "이 조건으로 견적서 발급"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
    {/* Print-only counterpart of the result above - a non-admin visitor
        has no saved quote id to route to a dedicated /print page (see
        QuoteActions), so printing happens directly off this page via
        window.print() (handleQuickPrint's non-admin branch). An admin
        session instead saves a real quote first and opens its own
        canonical /print route in a new tab, so this counterpart never
        actually renders for that flow - kept mode-only (not admin-gated)
        as a harmless fallback for a manual Ctrl+P on this page. Hidden on
        screen (.print-only), shown only under @media print (globals.css),
        matching the dense forceTable layout the real print route and PDF
        export already use. */}
    {mode === "quick" && !calculating && !error && result && (
      <div className="print-only">
        <QuoteDocument
          company={company}
          quoteNumber={null}
          input={buildInput()}
          result={result}
          originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : ""}
          destinationLabel={destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : ""}
          forceTable
        />
      </div>
    )}
    </>
  );
}
