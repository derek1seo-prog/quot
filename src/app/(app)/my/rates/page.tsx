import { RateHeatmap } from "@/components/rates/RateHeatmap";
import { getContainerTypes, getRegions } from "@/lib/data-store";
import { getRateOverviewByRegion } from "@/lib/rate-overview";

export const dynamic = "force-dynamic";

const DESTINATION_PORT_NAMES: Record<string, string> = {
  incheon: "인천",
  busan: "부산",
  pyeongtaek: "평택",
};

export default async function MyRatesPage() {
  const regions = getRegions();
  const containerTypes = getContainerTypes();

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
        색이 진할수록 예상 비용이 높은 구간입니다. 셀에 마우스를 올리면 상세 내역을 볼 수 있습니다.
        내륙운송료는 화주별로 별도 협의되며, 아래 금액에는 포함되어 있지 않습니다.
      </p>

      {regionsWithData.length === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">아직 등록된 운임이 없습니다.</p>
      ) : (
        regionsWithData.map(({ region, rows }) => (
          <RateHeatmap
            key={region.id}
            regionNameKo={region.nameKo}
            rows={rows}
            destinationPortNames={DESTINATION_PORT_NAMES}
            containerTypes={containerTypes}
          />
        ))
      )}
    </div>
  );
}
