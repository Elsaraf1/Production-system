import * as XLSX from "xlsx";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "NA"] as const;

export const VALID_MATERIALS = ["MARBLE", "GLASS", "MIRROR", "PORCELAIN", "METAL", "HANDLES", "BRASS", "LAMITAK_LIPPING", "OTHER"] as const;
export type ValidMaterial = typeof VALID_MATERIALS[number];

function normaliseStatus(val: unknown): string | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const raw = String(val).trim();
  if (raw.startsWith("#")) return "NA";
  const s = raw.toUpperCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    "IN_PROGRESS": "IN_PROGRESS", "INPROGRESS": "IN_PROGRESS", "WIP": "IN_PROGRESS",
    "DONE": "DONE", "COMPLETE": "DONE", "COMPLETED": "DONE", "FINISHED": "DONE",
    "NA": "NA", "N/A": "NA", "#N/A": "NA", "NOT_APPLICABLE": "NA",
    "PENDING": "PENDING", "NOT_STARTED": "PENDING",
  };
  return map[s] ?? (VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]) ? s : undefined);
}

function excelDateToISO(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  if (!s) return undefined;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return undefined;
}

/** Case-insensitive column lookup */
function col(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const k = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
    if (k !== undefined) return row[k];
  }
  return undefined;
}

/** Validate that all required columns exist in the header row */
function validateColumns(
  header: string[],
  required: string[]
): string[] {
  const normalized = header.map(h => h.trim().toLowerCase());
  return required
    .filter(r => !normalized.includes(r.toLowerCase()))
    .map(r => `Missing required column: "${r}"`);
}

function readSheet(buffer: Buffer): { header: string[]; rows: Record<string, unknown>[] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const header = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { header, rows };
}

// ─── Planner Import ───────────────────────────────────────────────────────────

export interface PlannerRow {
  ppoNumber: string;
  clientName?: string;
  orderDate?: string;
  rsd?: string;
  itemCode: string;
  description?: string;
  productionOrderNo?: string;
  outstandingQty?: number;
  drawingStatus?: string;   drawingDate?: string;
  carpentryStatus?: string; carpentryDate?: string;
  paintingStatus?: string;  paintingDate?: string;
  upholsteryStatus?: string; upholsteryDate?: string;
  packingStatus?: string;   packingDate?: string;
  reasonOfDelay?: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: string[];
}

const PLANNER_REQUIRED = ["PPO Number", "Item Code"];

export function parsePlannerFile(buffer: Buffer): ParseResult<PlannerRow> {
  const { header, rows } = readSheet(buffer);
  const colErrors = validateColumns(header, PLANNER_REQUIRED);
  if (colErrors.length) return { rows: [], errors: colErrors };

  const result: PlannerRow[] = [];
  const errors: string[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const ppoNumber = String(col(r, "PPO Number", "ppo") ?? "").trim();
    const itemCode  = String(col(r, "Item Code", "item_code") ?? "").trim();
    if (!ppoNumber) { errors.push(`Row ${rowNum}: PPO Number is empty`); return; }
    if (!itemCode)  { errors.push(`Row ${rowNum}: Item Code is empty`); return; }

    const productionOrderNo = String(col(r, "Production Order No", "prod_order") ?? "").trim();
    const inventored = productionOrderNo.toLowerCase() === "inventored";

    result.push({
      ppoNumber,
      clientName: String(col(r, "Client Name", "client") ?? "").trim() || undefined,
      orderDate: excelDateToISO(col(r, "Order Date", "order_date")),
      rsd: excelDateToISO(col(r, "RSD", "required_shipping_date")),
      itemCode,
      description: String(col(r, "Description") ?? "").trim() || undefined,
      productionOrderNo: productionOrderNo || undefined,
      outstandingQty: Number(col(r, "Outstanding Qty", "qty") ?? 0) || undefined,
      drawingStatus:    inventored ? "DONE" : normaliseStatus(col(r, "Drawing Status",    "drawing")),
      drawingDate:      inventored ? undefined : excelDateToISO(col(r, "Drawing Date")),
      carpentryStatus:  inventored ? "DONE" : normaliseStatus(col(r, "Carpentry Status",  "carpentry")),
      carpentryDate:    inventored ? undefined : excelDateToISO(col(r, "Carpentry Date")),
      paintingStatus:   inventored ? "DONE" : normaliseStatus(col(r, "Painting Status",   "painting")),
      paintingDate:     inventored ? undefined : excelDateToISO(col(r, "Painting Date")),
      upholsteryStatus: inventored ? "DONE" : normaliseStatus(col(r, "Upholstery Status", "upholstery")),
      upholsteryDate:   inventored ? undefined : excelDateToISO(col(r, "Upholstery Date")),
      packingStatus:    inventored ? "DONE" : normaliseStatus(col(r, "Packing Status",    "packing")),
      packingDate:      inventored ? undefined : excelDateToISO(col(r, "Packing Date")),
      reasonOfDelay:    String(col(r, "Reason of Delay") ?? "").trim() || undefined,
    });
  });

  return { rows: result, errors };
}

// ─── Releasing Order ──────────────────────────────────────────────────────────

export interface ReleasingRow { ppoNumber: string; itemCode: string; }

const RELEASING_REQUIRED = ["PPO Number", "Item Code"];

export function parseReleasingFile(buffer: Buffer): ParseResult<ReleasingRow> {
  const { header, rows } = readSheet(buffer);
  const colErrors = validateColumns(header, RELEASING_REQUIRED);
  if (colErrors.length) return { rows: [], errors: colErrors };

  const result: ReleasingRow[] = [];
  const errors: string[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const ppoNumber = String(col(r, "PPO Number", "ppo") ?? "").trim();
    const itemCode  = String(col(r, "Item Code", "item_code") ?? "").trim();
    if (!ppoNumber) { errors.push(`Row ${rowNum}: PPO Number is empty`); return; }
    if (!itemCode)  { errors.push(`Row ${rowNum}: Item Code is empty`); return; }
    result.push({ ppoNumber, itemCode });
  });

  return { rows: result, errors };
}

// ─── Material Request ─────────────────────────────────────────────────────────

export interface MaterialRow { ppoNumber: string; itemCode: string; material: string; }

const MATERIAL_REQUIRED = ["PPO Number", "Item Code", "Material"];

function normaliseMaterial(val: unknown): string | undefined {
  if (!val) return undefined;
  const s = String(val).trim().toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    "MARBLE": "MARBLE", "GLASS": "GLASS", "MIRROR": "MIRROR",
    "PORCELAIN": "PORCELAIN", "METAL": "METAL",
    "HANDLE": "HANDLES", "HANDLES": "HANDLES",
    "BRASS": "BRASS",
    "LAMITAK": "LAMITAK_LIPPING", "LIPPING": "LAMITAK_LIPPING",
    "LAMITAK_LIPPING": "LAMITAK_LIPPING", "LAMITAK_&_LIPPING": "LAMITAK_LIPPING",
    "LAMITAK_AND_LIPPING": "LAMITAK_LIPPING",
    "OTHER": "OTHER",
  };
  return map[s];
}

export function parseMaterialFile(buffer: Buffer): ParseResult<MaterialRow> {
  const { header, rows } = readSheet(buffer);
  const colErrors = validateColumns(header, MATERIAL_REQUIRED);
  if (colErrors.length) return { rows: [], errors: colErrors };

  const result: MaterialRow[] = [];
  const errors: string[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const ppoNumber = String(col(r, "PPO Number", "ppo") ?? "").trim();
    const itemCode  = String(col(r, "Item Code", "item_code") ?? "").trim();
    const material  = normaliseMaterial(col(r, "Material"));
    if (!ppoNumber) { errors.push(`Row ${rowNum}: PPO Number is empty`); return; }
    if (!itemCode)  { errors.push(`Row ${rowNum}: Item Code is empty`); return; }
    if (!material)  {
      errors.push(`Row ${rowNum}: Material "${col(r, "Material")}" is invalid. Valid: ${VALID_MATERIALS.join(", ")}`);
      return;
    }
    result.push({ ppoNumber, itemCode, material });
  });

  return { rows: result, errors };
}

// ─── Sample builders ──────────────────────────────────────────────────────────

function buildSample(headers: string[], example: unknown[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  XLSX.utils.book_append_sheet(wb, ws, "Sample");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildPlannerSample(): Buffer {
  return buildSample(
    ["PPO Number", "Client Name", "Order Date", "RSD", "Item Code", "Description",
     "Production Order No", "Outstanding Qty",
     "Drawing Status", "Drawing Date", "Carpentry Status", "Carpentry Date",
     "Painting Status", "Painting Date", "Upholstery Status", "Upholstery Date",
     "Packing Status", "Packing Date"],
    ["PPO-12345", "Client Name", "2026-01-01", "2026-06-30",
     "CHR-001", "Dining Chair", "PO-001", 10,
     "DONE", "2026-02-01", "IN_PROGRESS", "", "PENDING", "", "PENDING", "", "PENDING", ""]
  );
}

export function buildReleasingSample(): Buffer {
  return buildSample(
    ["PPO Number", "Item Code"],
    ["PPO-12345", "CHR-001"]
  );
}

export function buildMaterialSample(): Buffer {
  return buildSample(
    ["PPO Number", "Item Code", "Material"],
    ["PPO-12345", "CHR-001", "MARBLE"]
  );
}
