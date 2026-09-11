# QUOT — 중국발 수입 포워딩 자동 견적 시스템

중국 → 한국 수입 FCL 운임 및 부대비용을 자동으로 계산하고, 고객에게 바로 전달 가능한
견적서를 생성하는 웹 서비스입니다. 실제 견적서 양식(I.S. SEA & AIR CO.,LTD)과 요율
데이터를 기준으로 설계되었습니다.

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4** — Apple 스타일의 미니멀한 디자인 시스템
- **파일 기반 데이터 스토어** (`src/data/*.json`) — 별도 DB 없이 관리자가 요율을 직접
  수정할 수 있는 구조. 추후 Postgres/Prisma 등으로 교체해도 계산 엔진과 UI는 그대로
  동작하도록 `src/lib/data-store.ts` 뒤로 완전히 캡슐화되어 있습니다.
- **html2canvas-pro + jsPDF** — 견적서 PDF 다운로드
- 브라우저 인쇄(`window.print`) — 별도 인쇄 레이아웃(`/quotes/[id]/print`)

## 실행 방법

```bash
npm install
npm run dev
```

http://localhost:3000 접속

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
    data-store.ts        # JSON 파일 기반 저장소 (서버 전용)
    quote-engine.ts      # 데이터 기반 견적 계산 엔진 (하드코딩 없음)
  data/                  # 실제 편집 가능한 요율/기준 데이터 (JSON)
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
Xingang, Shantou, Shenzhen, Guangzhou, Nansha)와 40FT 컨테이너 운임은 임의로 추정하지
않고 "미등록" 상태로 남겨두었으며, `/rates/north-china`, `/rates/south-china` 화면에서
관리자가 직접 입력할 수 있습니다.

## 주요 화면

- `/` — Dashboard
- `/quotes/new` — 새 견적 만들기 (출발지 → 컨테이너 → 기본정보 → 자동계산/미리보기)
- `/quotes` — 견적 목록
- `/quotes/[id]` — 견적 상세 (인쇄 / PDF 다운로드)
- `/rates/north-china`, `/rates/south-china` — 요율 관리 (셀 단위 인라인 수정, 자동 저장)
- `/customers` — 고객 관리
- `/settings` — 환율 및 회사 정보
