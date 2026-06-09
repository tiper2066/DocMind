import { z } from "zod";

// schedules.document_template_json 의 형태. /schedules 폼과 cron 함수가 공유.
export const ScheduleTemplate = z.object({
  type: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  reader: z.string().min(1).max(60),
  cta: z.string().min(1).max(60),
  objection: z.string().min(1).max(60),
  keyMessage: z.string().min(1).max(200),
  length: z.string().min(1).max(40),
  securityLevel: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .default(1),
});

export type ScheduleTemplateT = z.infer<typeof ScheduleTemplate>;

export function templateLengthPages(length: string): number {
  const m = /(\d+)/.exec(length);
  const n = m ? Number(m[1]) : NaN;
  if (Number.isFinite(n) && n >= 4 && n <= 30) return n;
  return 10;
}
