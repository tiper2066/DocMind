// 의존성 없는 5필드 cron 매처: 분 시 일 월 요일.
// 지원: `*`, `a`, `a,b`, `a-b`, `*/n`, `a-b/n`. (요일 0=일)
// Inngest 함수가 매분 틱마다 등록된 schedule.cron 이 "지금" 과 매치하는지 판별하는 용도.

function matchField(field: string, value: number): boolean {
  return field.split(",").some((raw) => {
    const part = raw.trim();
    if (part.length === 0) return false;

    let range = part;
    let step = 1;
    const slash = part.split("/");
    if (slash.length === 2) {
      range = slash[0];
      step = parseInt(slash[1], 10);
      if (!Number.isFinite(step) || step <= 0) return false;
    }

    if (range === "*") {
      return value % step === 0;
    }

    let lo: number;
    let hi: number;
    if (range.includes("-")) {
      const [a, b] = range.split("-").map((n) => parseInt(n, 10));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      lo = a;
      hi = b;
    } else {
      const a = parseInt(range, 10);
      if (!Number.isFinite(a)) return false;
      if (step === 1) return value === a;
      lo = a;
      hi = a;
    }

    if (value < lo || value > hi) return false;
    return (value - lo) % step === 0;
  });
}

export function cronMatches(expr: string, date: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return (
    matchField(fields[0], date.getMinutes()) &&
    matchField(fields[1], date.getHours()) &&
    matchField(fields[2], date.getDate()) &&
    matchField(fields[3], date.getMonth() + 1) &&
    matchField(fields[4], date.getDay())
  );
}

export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  // 각 필드가 허용 토큰만 포함하는지 가벼운 검증
  return fields.every((f) => /^(\*|\d+)([,\-/]\d+|\*\/\d+)*$/.test(f) || /^[\d*,\-/]+$/.test(f));
}
