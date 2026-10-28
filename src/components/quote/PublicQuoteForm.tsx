"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { CustomerCombobox } from "./CustomerCombobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { IncotermsSelect } from "./IncotermsSelect";
import { PortCombobox, type PortOption } from "./PortCombobox";
import { QuoteDocument } from "./QuoteDocument";
import { QuotePairSheet } from "./QuotePairSheet";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { QuoteResultSkeleton } from "./QuoteResultSkeleton";
import { SalesRepCombobox } from "./SalesRepCombobox";
import { ALL_IN_DEFAULT_DESTINATION_IDS } from "@/lib/all-in";
import { endOfMonthIso, todayIso } from "@/lib/format";
import type { ExcludedCharge, QuoteChargeEditor } from "@/lib/custom-charges";
import { useDebouncedValue, useRememberedSalesRepId } from "@/lib/hooks";
import type {
  CompanyInfo,
  ContainerType,
  CustomCharge,
  Customer,
  Port,
  QuoteInput,
  QuoteResult,
  Region,
  SalesRep,
} from "@/lib/types";
import { Check, Loader2, Pencil, Printer, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const TODAY = todayIso();

// Quick-quote mode has no real customer behind it unless isAdmin (an
// authenticated admin session resolves a real match via CustomerCombobox
// below), so 화주 starts blank for everyone (its placeholder just reads
// "화주명"). 담당자 does get a real default so the printed quote's 수신
// line never starts out blank - still editable (see editingAddressee
// below) for anyone who wants their own name/company to show on a
// printed/PDF'd sample quote.
const DEFAULT_QUICK_CONTACT_NAME = "수입 담당자님";

// Container-type button value for "20FT+40HQ": the first two container
// types, one of each, side by side on one sheet (see QuotePairSheet).
const PAIR_CONTAINER_ID = "__pair__";

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
  lssRegionIds = [],
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
  /** Regions with an LSS rate - where the "FOB + LSS" switch is offered. */
  lssRegionIds?: string[];
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
  // 견적일 (admin can back/forward-date it); 유효기간 follows it to the end
  // of that month until edited by hand.
  const [quickQuoteDate, setQuickQuoteDate] = useState(TODAY);
  const [quickValidUntil, setQuickValidUntil] = useState(endOfMonthIso(TODAY));
  const [validUntilTouched, setValidUntilTouched] = useState(false);
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
  const [pairedResult, setPairedResult] = useState<QuoteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Per-quote 단가 overrides an admin session can edit in the live preview
  // below, mirroring the admin wizard's own preview-step mechanism
  // (quotes/new/page.tsx) - keyed by chargeTypeId. Only ever populated
  // when isAdmin (RateCell is never rendered editable otherwise).
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  // 20FT+40HQ: overrides for the second (paired) container's sheet.
  const [pairedRateOverrides, setPairedRateOverrides] = useState<Record<string, number>>({});
  // "부가세 포함" adds 10% VAT on the VAT-applicable (shaded) lines to the total.
  const [vatIncluded, setVatIncluded] = useState(false);
  // "FOB + LSS": a non-EXW quote that still charges LSS (EXW always does).
  const [includeLss, setIncludeLss] = useState(false);
  // ALL-IN (surcharges folded into O/F): on by default for 부산착; a manual
  // choice holds until the destination changes.
  const [allInChoice, setAllInChoice] = useState<boolean | null>(null);
  const allIn = allInChoice ?? ALL_IN_DEFAULT_DESTINATION_IDS.includes(destinationPortId);
  const [pendingRateEdits, setPendingRateEdits] = useState(0);
  // Admin-only per-quote charge edits (QuoteDocument's editor): extra lines
  // typed in, and standard lines removed from this quote.
  const canEditCharges = isAdmin && mode === "quick";
  const [customCharges, setCustomCharges] = useState<CustomCharge[]>([]);
  const [excludedCharges, setExcludedCharges] = useState<ExcludedCharge[]>([]);
  // Admin's own USD→KRW rate for this quote; null = today's stored rate.
  const [exchangeRateOverride, setExchangeRateOverride] = useState<number | null>(null);
  const liveEditsKey = JSON.stringify([
    customCharges,
    excludedCharges.map((e) => e.chargeTypeId),
    exchangeRateOverride,
  ]);
  const chargeEditsKey = useDebouncedValue(liveEditsKey, 400);
  // The edits the shown totals were last calculated with - while it differs
  // from the live edits, totals are "반영 중", then briefly "반영됨".
  const [appliedEditsKey, setAppliedEditsKey] = useState(liveEditsKey);
  const chargesPending = canEditCharges && appliedEditsKey !== liveEditsKey;
  const [showApplied, setShowApplied] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = (text: string, action?: ToastMessage["action"]) => setToast({ id: Date.now(), text, action });
  const chargeEditor: QuoteChargeEditor | undefined = canEditCharges
    ? {
        customCharges,
        excluded: excludedCharges,
        pending: chargesPending,
        onAdd: (category) => {
          setCustomCharges((cs) => [
            ...cs,
            { id: Math.random().toString(36).slice(2, 10), category, nameKo: "", currency: "KRW", rate: 0 },
          ]);
          notify(`${category === "EXW_LOCAL" ? "현지" : "국내"} 부대비용에 항목을 추가했어요`);
        },
        onChange: (id, patch) => setCustomCharges((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))),
        onRemove: (id) => {
          const index = customCharges.findIndex((c) => c.id === id);
          const removed = customCharges[index];
          if (!removed) return;
          setCustomCharges((cs) => cs.filter((c) => c.id !== id));
          notify(`'${removed.nameKo.trim() || "항목"}' 삭제했어요`, {
            label: "되돌리기",
            onClick: () =>
              setCustomCharges((cs) =>
                cs.some((c) => c.id === id) ? cs : [...cs.slice(0, index), removed, ...cs.slice(index)],
              ),
          });
        },
        onExclude: (charge) => {
          setExcludedCharges((xs) => (xs.some((x) => x.chargeTypeId === charge.chargeTypeId) ? xs : [...xs, charge]));
          notify(`'${charge.nameKo}' 뺐어요`, {
            label: "되돌리기",
            onClick: () => setExcludedCharges((xs) => xs.filter((x) => x.chargeTypeId !== charge.chargeTypeId)),
          });
        },
        onRestore: (chargeTypeId) => {
          const restored = excludedCharges.find((x) => x.chargeTypeId === chargeTypeId);
          setExcludedCharges((xs) => xs.filter((x) => x.chargeTypeId !== chargeTypeId));
          notify(`'${restored?.nameKo ?? "항목"}' 다시 넣었어요`);
        },
      }
    : undefined;

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

  // Quick mode only - the customer portal keeps its single-container form.
  const pairTypes = mode === "quick" && containerTypes.length >= 2 ? containerTypes.slice(0, 2) : null;
  const pairMode = pairTypes !== null && containerTypeId === PAIR_CONTAINER_ID;

  const originPort = originPorts.find((p) => p.id === originPortId);
  const destinationPort = destinationPorts.find((p) => p.id === destinationPortId);
  const originLabel = originPort ? `${originPort.nameKo} (${originPort.name})` : "";
  // The LSS switch only means something off-EXW, for a region with an LSS rate.
  const lssApplies = incoterms !== "EXW" && Boolean(originPort?.regionId && lssRegionIds.includes(originPort.regionId));
  const destinationLabel = destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : "";

  function buildInput(
    overrides: Record<string, number> = rateOverrides,
    pairedOverrides: Record<string, number> = pairedRateOverrides,
  ): QuoteInput {
    return {
      customerId: mode === "quick" && isAdmin ? matchedQuickCustomer?.id : undefined,
      customerName: mode === "quick" ? quickCustomerName : (lockedCustomer?.name ?? ""),
      contactName: mode === "quick" ? quickContactName : lockedCustomer?.contactName,
      salesRepId: mode === "quick" && isAdmin ? quickSalesRepId : undefined,
      preparedBy: mode === "quick" ? (isAdmin ? (quickRep?.name ?? "") : "") : (preparedBy ?? ""),
      preparedByEmail: mode === "quick" ? (isAdmin ? quickRep?.email : undefined) : preparedByEmail,
      preparedByPhone: mode === "quick" ? (isAdmin ? quickRep?.phone : undefined) : preparedByPhone,
      quoteDate: mode === "quick" && isAdmin ? quickQuoteDate : TODAY,
      validUntil: mode === "quick" ? quickValidUntil : endOfMonthIso(TODAY),
      transportMode: "FCL",
      originCountryId: originPort?.countryId ?? "",
      originPortId,
      destinationCountryId: destinationPort?.countryId ?? "",
      destinationPortId,
      incoterms,
      ...(pairMode
        ? {
            container: { containerTypeId: pairTypes[0].id, quantity: 1 },
            pairedContainer: { containerTypeId: pairTypes[1].id, quantity: 1 },
            rateOverrides: overrides,
            pairedRateOverrides: pairedOverrides,
          }
        : { container: { containerTypeId, quantity: containerQuantity }, rateOverrides: overrides }),
      vatIncluded,
      ...(lssApplies && includeLss && { includeLss: true }),
      ...(allIn && { allIn: true }),
      ...(canEditCharges && {
        customCharges: customCharges.filter((c) => c.nameKo.trim() !== "" || c.rate > 0),
        excludedChargeTypeIds: excludedCharges.map((e) => e.chargeTypeId),
        ...(exchangeRateOverride !== null && { exchangeRateOverride }),
      }),
    };
  }

  const ready = Boolean(originPortId && destinationPortId && incoterms && containerTypeId);

  // Live preview - recalculates whenever the lookup conditions change,
  // rather than a separate "조회" button, so changing a condition reads
  // as adjusting a live quote rather than submitting a new query each time.
  // A recalculation caused only by charge-line edits refreshes the totals
  // in place - no skeleton swap, which would unmount the row being typed in.
  const conditionsKey = JSON.stringify([
    originPortId,
    destinationPortId,
    incoterms,
    containerTypeId,
    containerQuantity,
    debouncedQuickCustomerName,
    lssApplies && includeLss,
    allIn,
  ]);
  const lastConditionsKey = useRef("");
  useEffect(() => {
    if (!ready) {
      lastConditionsKey.current = "";
      requestAnimationFrame(() => {
        setResult(null);
        setPairedResult(null);
      });
      return;
    }
    const silent = lastConditionsKey.current === conditionsKey;
    lastConditionsKey.current = conditionsKey;
    let cancelled = false;
    requestAnimationFrame(() => {
      if (!cancelled && !silent) {
        setCalculating(true);
        setError(null);
      }
    });
    const input = buildInput();
    const editsUsed = liveEditsKey;
    const calculate = async (body: QuoteInput) => {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "계산에 실패했습니다.");
      return data as QuoteResult;
    };
    Promise.all([
      calculate(input),
      input.pairedContainer
        ? calculate({ ...input, container: input.pairedContainer, rateOverrides: input.pairedRateOverrides })
        : null,
    ])
      .then(([main, paired]) => {
        if (cancelled) return;
        setResult(main);
        setPairedResult(paired);
        if (silent && editsUsed !== appliedEditsKey) {
          setShowApplied(true);
          setTimeout(() => setShowApplied(false), 1500);
        }
        setAppliedEditsKey(editsUsed);
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
  }, [conditionsKey, chargeEditsKey, vatIncluded]);

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
  // `side` picks which sheet's 단가 changed in 20FT+40HQ mode ("paired" =
  // the second container); only that side is recalculated.
  async function handleRateOverride(chargeTypeId: string, rate: number, side: "main" | "paired" = "main") {
    setPendingRateEdits((n) => n + 1);
    try {
      const paired = side === "paired";
      const nextMain = paired ? rateOverrides : { ...rateOverrides, [chargeTypeId]: rate };
      const nextPaired = paired ? { ...pairedRateOverrides, [chargeTypeId]: rate } : pairedRateOverrides;
      const input = buildInput(nextMain, nextPaired);
      const body = paired && input.pairedContainer
        ? { ...input, container: input.pairedContainer, rateOverrides: nextPaired }
        : input;
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재계산에 실패했습니다.");
      if (paired) {
        setPairedRateOverrides(nextPaired);
        setPairedResult(data as QuoteResult);
      } else {
        setRateOverrides(nextMain);
        setResult(data as QuoteResult);
      }
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
      <Card className="p-4 sm:p-8">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <FieldGroup className="max-sm:col-span-2">
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
                    <FieldGroup className="max-sm:col-span-2">
                      <FieldLabel>담당자</FieldLabel>
                      <Input
                        value={quickContactName}
                        onChange={(e) => setQuickContactName(e.target.value)}
                        placeholder={DEFAULT_QUICK_CONTACT_NAME}
                      />
                    </FieldGroup>
                    <FieldGroup className="max-sm:col-span-2">
                      <FieldLabel>견적 담당자 (발신)</FieldLabel>
                      <SalesRepCombobox value={quickSalesRepId} onChange={setQuickSalesRepId} options={salesReps} />
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel hint={quickQuoteDate !== TODAY ? "오늘 아님" : undefined}>견적일</FieldLabel>
                      <DatePicker
                        value={quickQuoteDate}
                        onChange={(d) => {
                          const next = d || TODAY;
                          setQuickQuoteDate(next);
                          if (!validUntilTouched || quickValidUntil < next) setQuickValidUntil(endOfMonthIso(next));
                        }}
                        aria-label="견적일"
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <FieldLabel>유효기간</FieldLabel>
                      <DatePicker
                        value={quickValidUntil}
                        onChange={(d) => {
                          setQuickValidUntil(d);
                          setValidUntilTouched(true);
                        }}
                        min={quickQuoteDate}
                        aria-label="유효기간"
                      />
                    </FieldGroup>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <FieldGroup>
            <FieldLabel>출발항 (POL)</FieldLabel>
            <PortCombobox value={originPortId} onChange={setOriginPortId} options={polOptions} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>도착항 (POD)</FieldLabel>
            <PortCombobox
              value={destinationPortId}
              onChange={(id) => {
                setDestinationPortId(id);
                setAllInChoice(null);
              }}
              options={podOptions}
            />
            {destinationPortId && (
              <label className="mt-2 flex items-center gap-2 cursor-pointer select-none text-[12.5px] text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={allIn}
                  onChange={(e) => {
                    setAllInChoice(e.target.checked);
                    // An edited O/F 단가 meant the other basis - start over.
                    const dropOf = (o: Record<string, number>) => {
                      const next = { ...o };
                      delete next.OCEAN_FREIGHT;
                      return next;
                    };
                    setRateOverrides(dropOf);
                    setPairedRateOverrides(dropOf);
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  ALL-IN
                  <span className="ml-1 text-[var(--muted)]">· 할증료(BAF·CAF·CRS 등)를 해상 운임에 포함해요</span>
                </span>
              </label>
            )}
          </FieldGroup>
          <FieldGroup>
            <FieldLabel hint={mode === "quick" && !isAdmin ? "FOB 고정" : undefined}>선적 조건 (Incoterms)</FieldLabel>
            {mode === "quick" && !isAdmin ? (
              <Input value="FOB" disabled />
            ) : (
              <IncotermsSelect value={incoterms} onChange={setIncoterms} />
            )}
            {lssApplies && (
              <label className="mt-2 flex items-center gap-2 cursor-pointer select-none text-[12.5px] text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={includeLss}
                  onChange={(e) => setIncludeLss(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  LSS(저유황할증료) 추가
                  <span className="ml-1 text-[var(--muted)]">· {incoterms}여도 현지 부대비용에 LSS만 넣어요</span>
                </span>
              </label>
            )}
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>컨테이너 타입</FieldLabel>
            {/* Phone: the type buttons get the full row, 수량 its own line. */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex gap-2">
                {[
                  ...containerTypes,
                  ...(pairTypes ? [{ id: PAIR_CONTAINER_ID, label: `${pairTypes[0].label}+${pairTypes[1].label}` }] : []),
                ].map((ct) => {
                  const selected = ct.id === containerTypeId;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => {
                        if (ct.id === containerTypeId) return;
                        setContainerTypeId(ct.id);
                        // 단가 overrides belong to one container type - a 20FT
                        // rate must never carry over to a 40HQ quote.
                        setRateOverrides({});
                        setPairedRateOverrides({});
                      }}
                      title={ct.id === PAIR_CONTAINER_ID ? "컨테이너 1개 기준, 두 타입을 한 장에 나란히" : undefined}
                      className={`${ct.id === PAIR_CONTAINER_ID ? "flex-[1.5] whitespace-nowrap px-2" : "flex-1"} h-10 rounded-[var(--radius-sm)] border-2 text-[13.5px] font-semibold transition-toggle-select ${
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
              <label className="flex items-center gap-2">
                <span className="sm:hidden text-[13px] text-[var(--muted)]">수량</span>
                <Input
                  type="number"
                  min={1}
                  value={pairMode ? 1 : containerQuantity}
                  disabled={pairMode}
                  title={pairMode ? "20FT+40HQ는 컨테이너 1개 기준입니다" : undefined}
                  aria-label="수량"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setContainerQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                {pairMode && <span className="sm:hidden text-[12px] text-[var(--muted)]">컨테이너 1개 기준</span>}
              </label>
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
            // Phone: 환율 gets its own full row, then 부가세 + 인쇄 share one.
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 max-w-[900px] mx-auto">
              {isAdmin && (pendingRateEdits > 0 || chargesPending) ? (
                <span className="text-[12px] text-[var(--muted)] flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
                  <Loader2 size={13} className="animate-spin" /> {pendingRateEdits > 0 ? "단가" : "합계"} 반영 중...
                </span>
              ) : (
                showApplied && (
                  <span className="text-[12px] font-medium text-[var(--success)] flex items-center gap-1 animate-dropdown-panel max-sm:w-full max-sm:justify-end">
                    <Check size={13} /> 반영됨
                  </span>
                )
              )}
              {canEditCharges && (
                <ExchangeRateControl
                  rate={result.exchangeRate}
                  custom={exchangeRateOverride !== null}
                  onCommit={(rate) => {
                    setExchangeRateOverride(rate);
                    notify(`환율 ₩${rate.toLocaleString()} 적용`);
                  }}
                  onReset={() => {
                    setExchangeRateOverride(null);
                    notify("오늘 환율로 되돌렸어요");
                  }}
                />
              )}
              <div
                role="radiogroup"
                aria-label="부가세 표시"
                className="inline-flex max-sm:flex-1 p-0.5 rounded-full bg-[var(--sidebar-bg)] text-[12.5px] font-medium"
              >
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={vatIncluded === v}
                    onClick={() => setVatIncluded(v)}
                    className={`max-sm:flex-1 px-3 h-8 max-sm:h-9 rounded-full transition-colors ${
                      vatIncluded === v
                        ? "bg-white shadow-sm text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    부가세 {v ? "포함" : "별도"}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleQuickPrint}
                disabled={saving || pendingRateEdits > 0 || chargesPending}
                className="max-sm:h-10 max-sm:px-4"
                icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              >
                {saving ? "저장 중..." : "인쇄"}
              </Button>
            </div>
          )}
          {pairMode ? (
            pairedResult && (
              <div className="max-w-[900px] mx-auto">
                <QuotePairSheet
                  company={company}
                  quoteNumber={null}
                  input={buildInput()}
                  result={result}
                  pairedResult={pairedResult}
                  originLabel={originLabel}
                  destinationLabel={destinationLabel}
                  fitToWidth
                  editor={chargeEditor}
                  onRateChange={isAdmin ? (side, id, rate) => handleRateOverride(id, rate, side) : undefined}
                />
              </div>
            )
          ) : (
            <QuoteDocument
              company={company}
              quoteNumber={null}
              input={buildInput()}
              result={result}
              originLabel={originLabel}
              destinationLabel={destinationLabel}
              onRateChange={isAdmin ? handleRateOverride : undefined}
              editor={chargeEditor}
            />
          )}
          {isAdmin && mode === "quick" && !pairMode && (
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
        {pairMode ? (
          pairedResult && (
            <QuotePairSheet
              company={company}
              quoteNumber={null}
              input={buildInput()}
              result={result}
              pairedResult={pairedResult}
              originLabel={originLabel}
              destinationLabel={destinationLabel}
            />
          )
        ) : (
          <div className="print-center-portrait">
            <QuoteDocument
              company={company}
              quoteNumber={null}
              input={buildInput()}
              result={result}
              originLabel={originLabel}
              destinationLabel={destinationLabel}
              forceTable
            />
          </div>
        )}
      </div>
    )}
    <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

/** Quick quote (admin): the USD→KRW rate this quote is calculated at. Shows
 * the rate in use (today's stored rate until edited); typing commits on
 * blur / Enter, Esc cancels. Once custom, "오늘 환율" goes back. */
function ExchangeRateControl({
  rate,
  custom,
  onCommit,
  onReset,
}: {
  rate: number;
  custom: boolean;
  onCommit: (rate: number) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = Math.round(Number(draft.replace(/,/g, "")) * 100) / 100;
    setDraft(null);
    if (Number.isFinite(next) && next > 0 && next !== rate) onCommit(next);
  };
  return (
    <div
      className={`inline-flex max-sm:w-full items-center gap-1 h-9 pl-3 pr-1 rounded-full text-[12.5px] font-medium ${
        custom ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--sidebar-bg)] text-[var(--muted)]"
      }`}
    >
      <label htmlFor="quote-exchange-rate" className="whitespace-nowrap">
        환율 USD 1 = ₩
      </label>
      <input
        id="quote-exchange-rate"
        inputMode="decimal"
        value={draft ?? rate.toLocaleString()}
        onFocus={(e) => {
          setDraft(String(rate));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        title={custom ? "직접 정한 환율" : "오늘 환율 (클릭해서 변경)"}
        className="w-[72px] max-sm:flex-1 h-7 rounded-full bg-white px-2 text-[16px] sm:text-[12.5px] max-sm:text-right tabular-nums text-[var(--foreground)] border border-transparent focus:border-[var(--accent)] focus:outline-none"
      />
      {custom && (
        <button
          type="button"
          onClick={onReset}
          className="h-7 px-2 rounded-full whitespace-nowrap hover:bg-white/70"
        >
          오늘 환율
        </button>
      )}
    </div>
  );
}
