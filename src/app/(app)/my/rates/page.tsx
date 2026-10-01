import { RateHeatmap } from "@/components/rates/RateHeatmap";
import { getContainerTypes, getDestinationPorts, getRegions } from "@/lib/data-store";
import { getRateOverviewByRegion } from "@/lib/rate-overview";
import { getApplicableLocalChargeTypes } from "@/lib/quote-engine";

export const dynamic = "force-dynamic";

// A region's SURCHARGE-category charges are what's worth calling out as
// "별도" next to the compact ocean-freight-only cell - the fixed LOCAL
// charges (THC, wharfage, etc.) stay silently folded into the tooltip's
// lumped 부대비용 계 line instead, to keep this caption short. Reuses
// getApplicableLocalChargeTypes (the same source the admin rates pages
// already use), so a future region needs no new caption logic here.
const SURCHARGE_SHORT_LABEL: Record<string, string> = { LSS_SURCHARGE: "LSS" };

function surchargeCaption(regionId: string): string {
  const names = getApplicableLocalChargeTypes(regionId, "FCL")
    .filter((ct) => ct.category === "SURCHARGE")
    .map((ct) => SURCHARGE_SHORT_LABEL[ct.id] ?? ct.id);
  const prefix = names.length > 0 ? `${names.join("·")} 등 ` : "";
  return `${prefix}부대비용은 별도이며, 포함한 예상 총비용은 셀에 마우스를 올리거나 탭하면 볼 수 있습니다.`;
}

export default async function MyRatesPage() {
  const regions = getRegions();
  const containerTypes = getContainerTypes();
  const destinationPortNames = Object.fromEntries(
    getDestinationPorts().map((p) => [p.id, p.nameKo]),
  );

  const overviewsByRegion = await Promise.all(
    regions.map(async (region) => ({ region, rows: await getRateOverviewByRegion(region.id) })),
  );
  const regionsWithData = overviewsByRegion.filter(({ rows }) =>
    rows.some((r) => r.cells.some((c) => c.grandTotalKrw != null)),
  );

  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <p className="text-[13px] font-medium text-[var(--accent)] mb-2">운임표 보기</p>
      <h1 className="text-[28px] font-semibold tracking-tight mb-1">구간별 운임 한눈에 보기</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">
        해상운임을 기준으로 표시되며, 색이 진할수록 운임이 높은 구간입니다. 셀에 마우스를 올리거나 탭하면 부대비용을 포함한 예상 총비용을 확인할 수 있습니다.
      </p>

      {regionsWithData.length === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">아직 등록된 운임이 없습니다.</p>
      ) : (
        regionsWithData.map(({ region, rows }) => (
          <RateHeatmap
            key={region.id}
            regionNameKo={region.nameKo}
            surchargeCaption={surchargeCaption(region.id)}
            rows={rows}
            destinationPortNames={destinationPortNames}
            containerTypes={containerTypes}
          />
        ))
      )}
    </div>
  );
}
