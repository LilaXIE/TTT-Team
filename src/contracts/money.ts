// 金额一律整数分（bigint）。API 传十进制字符串。禁止 Number(金额)。

export type Minor = bigint;

const MINOR_RE = /^-?\d+$/;

/** "13800" -> 13800n。非法输入抛错。 */
export function parseMinor(input: string | number | bigint): Minor {
  if (typeof input === "bigint") return input;
  if (typeof input === "number") {
    if (!Number.isInteger(input)) throw new Error(`parseMinor: non-integer ${input}`);
    return BigInt(input);
  }
  const s = input.trim();
  if (!MINOR_RE.test(s)) throw new Error(`parseMinor: invalid "${input}"`);
  return BigInt(s);
}

/** 13800n -> "13800"（API 用） */
export function minorToString(v: Minor): string {
  return v.toString();
}

/** "150" 或 "150.5" 港元 -> 15000n / 15050n（表单输入用） */
export function hkdToMinor(input: string | number): Minor {
  const s = String(input).trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`hkdToMinor: invalid "${input}"`);
  const sign = m[1] === "-" ? -1n : 1n;
  const whole = BigInt(m[2]);
  const frac = BigInt((m[3] ?? "").padEnd(2, "0"));
  return sign * (whole * 100n + frac);
}

/** 13800n -> "$138.00"；1234550n -> "$12,345.50" */
export function formatHKD(v: Minor): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${wholeStr}.${frac}`;
}

export function sumMinor(values: Iterable<Minor>): Minor {
  let t = 0n;
  for (const v of values) t += v;
  return t;
}

/** a 占 b 的百分比（向下取整），b<=0 返回 0 */
export function pctOf(a: Minor, b: Minor): number {
  if (b <= 0n) return 0;
  return Number((a * 100n) / b);
}

/** 把对象中所有 bigint 转为字符串，便于 JSON 序列化 */
export function serializeBigints<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as T;
}
