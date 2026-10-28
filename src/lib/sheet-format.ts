/** The 컨테이너 시트 columns and how their values read, copy and paste -
 * matching the team's "선복 진행 예정 일정" Excel / Google Sheet so rows
 * round-trip between the two. Pure (no React), shared by the editor. */

export interface SheetValues {
  importer: string;
  exporter: string;
  pol: string;
  pod: string;
  size: "20" | "40";
  vsl: string;
  containerNo: string;
  hbl: string;
  /** "YYYY-MM-DD" or "" */
  etd: string;
  eta: string;
  freeTimeUntil: string;
  deliveryDate: string;
  /** "HH:mm" or "" */
  deliveryTime: string;
  surrendered: boolean;
  settled: boolean;
  memo: string;
}

export type SheetKey = keyof SheetValues;
export type ColKind = "readonly" | "text" | "upper" | "date" | "time" | "size" | "flag";
/** row = this container; vessel = the voyage (every box on the ship);
 * hbl = every box on the HB/L. */
export type ColScope = "row" | "vessel" | "hbl";

export interface SheetCol {
  key: SheetKey | "no";
  label: string;
  width: number;
  kind: ColKind;
  scope: ColScope;
  align?: "center";
}

export const SHEET_COLS: SheetCol[] = [
  { key: "no", label: "NO", width: 52, kind: "readonly", scope: "row", align: "center" },
  { key: "importer", label: "수입자", width: 150, kind: "text", scope: "row" },
  { key: "exporter", label: "수출자", width: 200, kind: "text", scope: "row" },
  { key: "pol", label: "선적지", width: 76, kind: "text", scope: "vessel", align: "center" },
  { key: "pod", label: "양하지", width: 76, kind: "text", scope: "vessel", align: "center" },
  { key: "size", label: "CNTR", width: 60, kind: "size", scope: "row", align: "center" },
  { key: "vsl", label: "VSL", width: 220, kind: "upper", scope: "vessel" },
  { key: "containerNo", label: "CTNS NO", width: 128, kind: "upper", scope: "row" },
  { key: "hbl", label: "HB/L", width: 136, kind: "upper", scope: "row", align: "center" },
  { key: "etd", label: "출항일", width: 120, kind: "date", scope: "vessel" },
  { key: "eta", label: "입항일", width: 120, kind: "date", scope: "vessel" },
  { key: "freeTimeUntil", label: "프리타임", width: 132, kind: "date", scope: "row" },
  { key: "deliveryDate", label: "운송일", width: 120, kind: "date", scope: "row" },
  { key: "deliveryTime", label: "운송시간", width: 92, kind: "time", scope: "row", align: "center" },
  { key: "surrendered", label: "서렌더 여부", width: 96, kind: "flag", scope: "hbl", align: "center" },
  { key: "settled", label: "정산 여부", width: 96, kind: "flag", scope: "hbl", align: "center" },
  { key: "memo", label: "비고", width: 200, kind: "text", scope: "row" },
];

export function emptyValues(): SheetValues {
  return {
    importer: "",
    exporter: "",
    pol: "",
    pod: "",
    size: "40",
    vsl: "",
    containerNo: "",
    hbl: "",
    etd: "",
    eta: "",
    freeTimeUntil: "",
    deliveryDate: "",
    deliveryTime: "",
    surrendered: false,
    settled: false,
    memo: "",
  };
}

// ---- display / copy ---------------------------------------------------------

/** "08월 17일" - the sheet's own date style. */
export function formatSheetDate(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${m}월 ${d}일`;
}

/** "06시", or "06:30" when there are minutes. */
export function formatSheetTime(t: string): string {
  if (!t) return "";
  return t.endsWith(":00") ? `${t.slice(0, 2)}시` : t;
}

/** How a cell reads on screen and when copied out. */
export function formatCell(col: SheetCol, v: SheetValues, rowNo: number | null): string {
  if (col.key === "no") return rowNo === null ? "" : String(rowNo);
  const value = v[col.key];
  switch (col.kind) {
    case "date":
      return formatSheetDate(value as string);
    case "time":
      return formatSheetTime(value as string);
    case "flag":
      return value ? "완료" : "";
    default:
      return String(value ?? "");
  }
}

// ---- parse (typed or pasted) ------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Month/day without a year: the year that puts it closest to today. */
export function inferYear(month: number, day: number, today: string): number {
  const ty = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T00:00:00Z`);
  let best = ty;
  let bestDiff = Infinity;
  for (const y of [ty - 1, ty, ty + 1]) {
    if (!validYmd(y, month, day)) continue;
    const diff = Math.abs(Date.UTC(y, month - 1, day) - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = y;
    }
  }
  return best;
}

/** "08월 17일", "8월17일", "8/17", "08-17", "2026-08-17", "2026.08.17",
 * "2026/8/17", "26.08.17" -> "YYYY-MM-DD"; "" -> ""; null = unreadable. */
export function parseSheetDate(raw: string, today: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?(\s*\(.+\))?$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])];
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?(\s*\(.+\))?$/);
  if (m) {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    const y = inferYear(mo, d, today);
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

/** "06시", "6시", "6시 30분", "06:00", "6:30", "0600" -> "HH:mm"; "" -> "". */
export function parseSheetTime(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return "";
  let m = s.match(/^(오전|오후)?(\d{1,2})시(?:(\d{1,2})분?)?$/);
  if (m) {
    let h = Number(m[2]);
    if (m[1] === "오후" && h < 12) h += 12;
    if (m[1] === "오전" && h === 12) h = 0;
    const min = Number(m[3] ?? 0);
    return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
  }
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/) ?? s.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const [h, min] = [Number(m[1]), Number(m[2])];
    return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
  }
  return null;
}

/** "20", "20GP", "20FT", "40", "40HQ", "40HC" ... -> "20" | "40". */
export function parseSheetSize(raw: string): "20" | "40" | null {
  const s = raw.trim().toUpperCase();
  if (/^20/.test(s)) return "20";
  if (/^40|^45/.test(s)) return "40";
  return null;
}

/** "완료", "O", "Y", "TRUE", "✓", "1" -> true; "", "미완료", "X", "N" -> false. */
export function parseSheetFlag(raw: string): boolean | null {
  const s = raw.trim().toUpperCase();
  if (["완료", "O", "Y", "YES", "TRUE", "✓", "V", "1", "OK", "●"].includes(s)) return true;
  if (["", "미완료", "X", "N", "NO", "FALSE", "0", "-"].includes(s)) return false;
  return null;
}

export type ParsedCell = { ok: true; value: SheetValues[SheetKey] } | { ok: false; message: string };

export function parseCell(col: SheetCol, raw: string, today: string): ParsedCell {
  switch (col.kind) {
    case "readonly":
      return { ok: false, message: "" };
    case "date": {
      const v = parseSheetDate(raw, today);
      return v === null ? { ok: false, message: `날짜 형식을 알 수 없어요: "${raw}"` } : { ok: true, value: v };
    }
    case "time": {
      const v = parseSheetTime(raw);
      return v === null ? { ok: false, message: `시간 형식을 알 수 없어요: "${raw}"` } : { ok: true, value: v };
    }
    case "size": {
      const v = parseSheetSize(raw);
      return v === null ? { ok: false, message: `CNTR은 20 또는 40이에요: "${raw}"` } : { ok: true, value: v };
    }
    case "flag": {
      const v = parseSheetFlag(raw);
      return v === null ? { ok: false, message: `완료 / 미완료로 적어 주세요: "${raw}"` } : { ok: true, value: v };
    }
    case "upper":
      return { ok: true, value: raw.trim().replace(/\s+/g, " ").toUpperCase() };
    default:
      return { ok: true, value: raw.trim() };
  }
}

// ---- TSV (Excel / Google Sheets clipboard) ---------------------------------

/** Clipboard text from Excel / Google Sheets -> rows of cells. Handles
 * quoted cells (with tabs, newlines or "" inside). */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function toTsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join("\t"))
    .join("\n");
}
