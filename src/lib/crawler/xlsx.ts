import * as XLSX from "xlsx";
import type { ExtractResult } from "./types";

export function extractXlsx(buf: ArrayBuffer): ExtractResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sections: string[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const trimmed = csv.trim();
    if (trimmed.length === 0) continue;
    sections.push(`# ${name}\n${trimmed}`);
  }

  const text = sections.join("\n\n");
  const title =
    typeof wb.Props?.Title === "string" && wb.Props.Title.trim().length > 0
      ? wb.Props.Title.trim()
      : wb.SheetNames[0];

  return {
    title,
    text,
    meta: { sheets: wb.SheetNames },
  };
}
