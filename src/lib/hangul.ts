/** Korean-aware search matching.
 *
 * While typing Korean, the input briefly holds an unfinished syllable -
 * "김ㅌ" on the way to "김태현" - which a plain substring check doesn't
 * match, so result lists flicker empty on every keystroke. Matching on
 * decomposed jamo fixes that ("김ㅌ" -> ㄱㅣㅁㅌ is inside ㄱㅣㅁㅌㅐㅎㅕㄴ),
 * and an all-consonant query also matches initials ("ㄱㅌㅎ" -> 김태현). */

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
// Compound finals split into their parts, so "닭" (ㄷㅏㄺ) still matches
// a query typed as "달ㄱ".
const SPLIT: Record<string, string> = {
  ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ",
};
const BASE = 0xac00;
const LAST = 0xd7a3;

function decompose(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    const code = ch.charCodeAt(0);
    if (code < BASE || code > LAST) {
      out += SPLIT[ch] ?? ch;
      continue;
    }
    const i = code - BASE;
    const jong = JONG[i % 28];
    out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + (SPLIT[jong] ?? jong);
  }
  return out;
}

function initials(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code >= BASE && code <= LAST ? CHO[Math.floor((code - BASE) / 588)] : ch.toLowerCase();
  }
  return out;
}

const ONLY_CONSONANTS = /^[ㄱ-ㅎ\s]+$/;

/** True when `query` (possibly mid-composition) matches somewhere in `text`. */
export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (text.toLowerCase().includes(q.toLowerCase())) return true;
  if (ONLY_CONSONANTS.test(q) && initials(text).replace(/\s/g, "").includes(q.replace(/\s/g, ""))) return true;
  return decompose(text).includes(decompose(q));
}

/** True when `text` starts with `query` (same rules) - for ranking. */
export function startsWithSearch(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (ONLY_CONSONANTS.test(q)) return initials(text).replace(/\s/g, "").startsWith(q.replace(/\s/g, ""));
  return decompose(text).startsWith(decompose(q));
}
