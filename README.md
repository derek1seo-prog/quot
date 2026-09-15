# QUOT — 중국발 수입 포워딩 자동 견적 시스템

중국 → 한국 수입 FCL 운임 및 부대비용을 자동으로 계산하고, 고객에게 바로 전달 가능한
견적서를 생성하는 웹 서비스입니다. 실제 견적서 양식(I.S. SEA & AIR CO.,LTD)과 요율
데이터를 기준으로 설계되었습니다.

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4** — Apple 스타일의 미니멀한 디자인 시스템
- **하이브리드 데이터 스토어** (`src/lib/data-store.ts`) — 지역/항구/컨테이너 타입 등
  정적 기준 데이터는 `src/data/*.json`에서 읽고, 요율·고객·견적처럼 자주 바뀌는 데이터는
  Redis(Upstash, Vercel Storage 연동)가 설정되어 있으면 그쪽을 쓰고 없으면 로컬 JSON
  파일에 쓰도록 되어 있습니다. 계산 엔진과 UI는 이 모듈 뒤로 완전히 캡슐화되어 있어
  저장소를 바꿔도 영향받지 않습니다.
- **html2canvas-pro + jsPDF** — 견적서 PDF 다운로드
- 브라우저 인쇄(`window.print`) — 별도 인쇄 레이아웃(`/quotes/[id]/print`)

## 실행 방법

```bash
npm install
npm run dev
```

http://localhost:3000 접속 — 로컬에서는 별도 설정 없이 `src/data/*.json` 파일을 그대로
읽고 씁니다.

## 배포 시 데이터 영속성 (중요)

Vercel 같은 서버리스 환경은 요청마다 다른 인스턴스로 라우팅될 수 있고, 각 인스턴스는
자신만의 임시 파일 시스템을 갖습니다. 그래서 로컬 JSON 파일에만 의존하면 "방금 만든
견적을 저장하고 보기"가 다른 인스턴스에서 처리되어 404가 날 수 있습니다.

이를 해결하려면 Redis를 연결하세요 (1분 소요, 코드 수정 불필요):

1. Vercel 프로젝트 대시보드 → **Storage** 탭 → **Create Database**
2. Redis 계열 통합(예: *Upstash for Redis*) 선택 후 **Connect to Project**
3. 재배포하면 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (또는 레거시
   `KV_REST_API_URL` / `KV_REST_API_TOKEN`) 환경변수가 자동 주입되고, 앱이 이를 감지해
   요율·고객·견적 데이터를 Redis에 저장합니다.

연결하지 않으면 앱은 계속 동작하지만(크래시 없음), 저장된 견적/요율 수정 내용이
인스턴스마다 다르게 보이거나 재배포 시 초기화될 수 있습니다 — 데모 용도로는 괜찮지만
실제 운영에는 Redis 연결을 권장합니다. 로컬 개발 환경에는 영향이 없습니다.

## 폴더 구조

```
src/
  app/
    (app)/              # 사이드바가 있는 관리 화면 (Dashboard, 견적, 요율, 고객, 설정)
    quotes/[id]/print/  # 인쇄/PDF용 chrome-less 레이아웃
    api/                # REST API (meta, calculate, quotes, rates, customers)
  components/
    layout/             # Sidebar, 모바일 내비게이션
    quote/              # 견적 마법사, 견적서 문서(QuoteDocument), PDF/인쇄 액션
    rates/              # 요율 관리 인라인 편집 컴포넌트
    ui/                 # 공용 UI 프리미티브
  lib/
    types.ts            # 도메인 타입 (Region, Port, ChargeType, QuoteResult ...)
    data-store.ts        # 데이터 접근 계층 (정적 JSON 읽기 + Redis/JSON 파일 쓰기, 서버 전용)
    quote-engine.ts      # 데이터 기반 견적 계산 엔진 (하드코딩 없음)
  data/                  # 정적 기준 데이터(JSON) + 로컬 개발용 초기 요율/견적 시드
```

## 데이터 모델 핵심 개념

- **Region(권역)**: 북중국/동중국, 남중국 등. 지역마다 어떤 부대비용(BAF/CAF/CRS 또는
  EBS/CRS)이 적용되는지는 `charge-types.json`의 `visibility` 필드로 결정됩니다.
- **Port(항구)**: 각 항구는 하나의 Region에 속하며, Region이 바뀌면 부대비용 구성도
  자동으로 바뀝니다.
- **OceanFreightRate**: (항구, 컨테이너 타입)별 기본 운임 — 유일하게 항구 단위로 관리됩니다.
- **ChargeRate**: (Region, 비용 항목, 컨테이너 타입)별 요율 — 지역 단위로 관리됩니다.
- 새로운 지역/항구/컨테이너 타입/비용 항목을 추가하려면 **코드가 아니라 `src/data/*.json`
  데이터**만 수정하면 됩니다. 베트남, LCL, 항공화물 확장도 이 구조를 그대로 재사용합니다
  (예: `TransportMode`에 `"LCL" | "AIR"` 추가, Region/Port에 베트남 데이터 추가).

## 실제 데이터 출처

`src/data/ocean-freight-rates.json`, `charge-rates.json`의 수치는 제공된 기존 견적서
파일(북중국/남중국 시트)의 실제 값을 그대로 반영했습니다. 파일에 없는 항구(Qingdao,
Xingang, Shantou, Shenzhen, Guangzhou, Nansha)의 운임은 임의로 추정하지 않고 "미등록"
상태로 남겨두었으며, `/rates/north-china`, `/rates/south-china` 화면에서 관리자가 직접
입력할 수 있습니다.

컨테이너 타입은 20FT와 40HQ만 지원합니다. 별도의 40FT(40GP) 옵션이 있었으나, 원본
요율 파일에서 40FT 운임이 40HQ와 항상 동일했기 때문에 제거하고 40HQ 하나로
통일했습니다.

## 주요 화면

- `/` — Dashboard
- `/quotes/new` — 새 견적 만들기 (출발지 → 컨테이너 → 기본정보 → 자동계산/미리보기)
- `/quotes` — 견적 목록
- `/quotes/[id]` — 견적 상세 (인쇄 / PDF 다운로드)
- `/rates/north-china`, `/rates/south-china` — 요율 관리 (셀 단위 인라인 수정, 자동 저장)
- `/customers` — 고객 관리
- `/settings` — 환율 및 회사 정보
