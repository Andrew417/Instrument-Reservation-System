/**
 * Instrument Room Key-Holder Handover Sheet Export Utilities (CSV & XLSX)
 */

import { formatHhmmTo12Hour, addDaysToDateString } from "./date-utils";
import ExcelJS from "exceljs";

export type HandoverExportFormat = "csv" | "xlsx";

export interface HandoverReservationItem {
  id: string;
  series_id?: string | null;
  user_id?: string | null;
  instrument_id: string;
  service_name: string;
  reservation_type: "in_church" | "outside_church" | string;
  status: string;
  start_time: string;
  end_time: string;
  reservation_date: string;
  start_hhmm: string;
  end_hhmm: string;
  instrument_name: string;
  instrument_type: string;
  user_name: string;
  user_phone: string;
}

export const HANDOVER_HEADERS = [
  "Date",
  "Start Time",
  "End Time",
  "Instrument",
  "Type/Category",
  "Service Name",
  "Reserved By",
  "Phone Number",
  "Usage Type",
] as const;

/**
 * Escape a CSV cell value according to RFC 4180
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Compute filename with .csv or .xlsx extension
 * e.g. reservations_2026-09-04.xlsx (Day)
 * e.g. reservations_2026-09-04_to_2026-09-10.xlsx (Week)
 */
export function getHandoverFileName(
  viewMode: "day" | "week",
  startDate: string,
  endDate: string,
  format: HandoverExportFormat = "xlsx",
): string {
  const ext = format === "csv" ? "csv" : "xlsx";
  if (viewMode === "day") {
    return `reservations_${startDate}.${ext}`;
  }
  return `reservations_${startDate}_to_${endDate}.${ext}`;
}

/**
 * Fetch approved handover reservations from backend API
 */
export async function fetchHandoverReservations(
  startDate: string,
  endDate: string,
  sessionToken?: string | null,
): Promise<HandoverReservationItem[]> {
  const token =
    sessionToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("church_session_token_v1")
      : null);

  const res = await fetch(
    `/api/admin/reservations/handover-sheet?startDate=${startDate}&endDate=${endDate}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    },
  );

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load handover reservations");
  }

  // Ensure chronological order: date ascending, then start time ascending
  const items: HandoverReservationItem[] = data.reservations || [];
  return items.sort((a, b) => {
    const dateComp = (a.reservation_date || "").localeCompare(b.reservation_date || "");
    if (dateComp !== 0) return dateComp;
    return (a.start_hhmm || "").localeCompare(b.start_hhmm || "");
  });
}

/**
 * Build CSV string for key-holder handover sheet
 * Ordered 9 Columns:
 * 1. Date
 * 2. Start Time
 * 3. End Time
 * 4. Instrument
 * 5. Type/Category
 * 6. Service Name
 * 7. Reserved By
 * 8. Phone Number
 * 9. Usage Type
 */
export function buildHandoverCsvContent(
  reservations: HandoverReservationItem[],
): string {
  const headers = [...HANDOVER_HEADERS];

  const rows = reservations.map((r) => {
    const startTime12 = r.start_hhmm ? formatHhmmTo12Hour(r.start_hhmm) : "";
    const endTime12 = r.end_hhmm ? formatHhmmTo12Hour(r.end_hhmm) : "";
    const usageType =
      r.reservation_type === "outside_church" ? "Outside" : "In-church";

    return [
      escapeCsvCell(r.reservation_date),
      escapeCsvCell(startTime12),
      escapeCsvCell(endTime12),
      escapeCsvCell(r.instrument_name),
      escapeCsvCell(r.instrument_type),
      escapeCsvCell(r.service_name || "General Service"),
      escapeCsvCell(r.user_name || "Unknown Member"),
      escapeCsvCell(r.user_phone || "N/A"),
      escapeCsvCell(usageType),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Trigger download of handover CSV file in browser
 */
export function downloadHandoverCsv(
  reservations: HandoverReservationItem[],
  fileName: string,
): { recordCount: number; isHeaderOnly: boolean } {
  const csvText = buildHandoverCsvContent(reservations);
  // Prepend \uFEFF UTF-8 BOM so Excel opens international characters cleanly
  const blob = new Blob(["\uFEFF" + csvText], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    recordCount: reservations.length,
    isHeaderOnly: reservations.length === 0,
  };
}

/**
 * Generate and trigger download of styled handover XLSX file in browser
 * Styling:
 * - Header row: Bold white text, dark navy church-brand fill (FF1E293B), frozen view
 * - Column widths: Auto-sized to content with comfortable padding
 * - Row banding: Alternating light-gray (FFF8FAFC) / white (FFFFFFFF)
 * - Usage Type: Color-coded cell (soft green FFDCFCE7 for "In-church", soft amber FFFEF3C7 for "Outside")
 * - Borders: Thin light-gray borders (FFE2E8F0) on all cells
 * - Alignment: Date & Time columns center-aligned; Usage Type center-aligned; rest left-aligned
 * - Font: Header 11pt Bold, Body 10pt Regular
 */
export async function downloadHandoverXlsx(
  reservations: HandoverReservationItem[],
  fileName: string,
): Promise<{ recordCount: number; isHeaderOnly: boolean }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Church Instrument Reservation System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Handover Schedule", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }],
    properties: { defaultRowHeight: 20 },
  });

  // 1. Add Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.values = [...HANDOVER_HEADERS];
  headerRow.height = 26;

  // Dark Navy Church Brand Fill: #1E293B -> ARGB FF1E293B
  const navyHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };

  // Thin light-gray grid border: #E2E8F0 -> ARGB FFE2E8F0
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = navyHeaderFill;
    cell.border = thinBorder;

    // Date (1), Start Time (2), End Time (3), Usage Type (9) center aligned
    if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 9) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    }
  });

  // 2. Add Data Rows
  reservations.forEach((r, idx) => {
    const startTime12 = r.start_hhmm ? formatHhmmTo12Hour(r.start_hhmm) : "";
    const endTime12 = r.end_hhmm ? formatHhmmTo12Hour(r.end_hhmm) : "";
    const isOutside = r.reservation_type === "outside_church";
    const usageText = isOutside ? "Outside" : "In-church";

    const row = worksheet.addRow([
      r.reservation_date,
      startTime12,
      endTime12,
      r.instrument_name,
      r.instrument_type,
      r.service_name || "General Service",
      r.user_name || "Unknown Member",
      r.user_phone || "N/A",
      usageText,
    ]);

    row.height = 21;

    // Row banding: Alternating light-gray (FFF8FAFC) and white (FFFFFFFF)
    const isEven = idx % 2 === 0;
    const rowBgColor = isEven ? "FFFFFFFF" : "FFF8FAFC";

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;

      if (colNumber === 9) {
        // Usage Type color-coded cell:
        // Soft green fill (FFDCFCE7) for "In-church" with deep green text (FF166534)
        // Soft amber/gold fill (FFFEF3C7) for "Outside" with deep amber text (FF92400E)
        if (isOutside) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF92400E" },
          };
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          };
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF166534" },
          };
        }
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowBgColor },
        };
        cell.font = {
          name: "Calibri",
          size: 10,
          color: { argb: "FF1E293B" },
        };

        // Center align Date (1), Start Time (2), End Time (3)
        if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      }
    });
  });

  // 3. Auto-size column widths based on content with comfortable padding & sensible minimums
  // Date, Start, End, Instrument, Type, Service Name, Reserved By, Phone, Usage Type
  const minWidths = [14, 13, 13, 22, 16, 24, 22, 16, 14];

  worksheet.columns.forEach((col, idx) => {
    let maxLen = 0;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : "";
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    const minW = minWidths[idx] || 14;
    col.width = Math.max(maxLen + 4, minW);
  });

  // 4. Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    recordCount: reservations.length,
    isHeaderOnly: reservations.length === 0,
  };
}

/**
 * Universal exporter supporting both CSV and XLSX
 */
export async function downloadHandoverExport(
  reservations: HandoverReservationItem[],
  fileName: string,
  format: HandoverExportFormat,
): Promise<{ recordCount: number; isHeaderOnly: boolean }> {
  if (format === "csv") {
    return downloadHandoverCsv(reservations, fileName);
  }
  return downloadHandoverXlsx(reservations, fileName);
}
