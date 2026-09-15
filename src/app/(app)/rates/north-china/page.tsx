import { RegionRatesEditor } from "@/components/rates/RegionRatesEditor";
import {
  getChargeRates,
  getContainerTypes,
  getOceanFreightRates,
  getPorts,
  getRegionById,
} from "@/lib/data-store";
import { getApplicableLocalChargeTypes } from "@/lib/quote-engine";

const REGION_ID = "north-china";

export const dynamic = "force-dynamic";

export default async function NorthChinaRatesPage() {
  const region = getRegionById(REGION_ID);
  const ports = getPorts().filter((p) => p.regionId === REGION_ID);
  const containerTypes = getContainerTypes();
  const chargeTypes = getApplicableLocalChargeTypes(REGION_ID, "FCL");
  const [allOceanFreightRates, allChargeRates] = await Promise.all([
    getOceanFreightRates(),
    getChargeRates(),
  ]);
  const oceanFreightRates = allOceanFreightRates.filter((r) =>
    ports.some((p) => p.id === r.portId),
  );
  const chargeRates = allChargeRates.filter((r) => r.regionId === REGION_ID);

  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <p className="text-[13px] font-medium text-[var(--accent)] mb-2">요율 관리</p>
      <h1 className="text-[28px] font-semibold tracking-tight mb-1">{region?.nameKo ?? "북중국"}</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">
        BAF · CAF · CRS 부대비용이 적용되는 권역입니다. Qingdao, Xingang, Shantou, Shanghai, Ningbo
      </p>

      <RegionRatesEditor
        regionId={REGION_ID}
        regionNameKo={region?.nameKo ?? "북중국"}
        ports={ports}
        containerTypes={containerTypes}
        chargeTypes={chargeTypes}
        initialOceanFreightRates={oceanFreightRates}
        initialChargeRates={chargeRates}
      />
    </div>
  );
}
