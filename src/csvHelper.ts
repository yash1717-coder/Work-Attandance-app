/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, AttendanceRec, PaymentRec } from "./db";

// Robust Excel-compatible CSV Parser that handles double quotes, row breaks, and commas inside fields
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \n
      }
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  // Filter out completely empty rows
  return lines.filter((r) => r.length > 0 && r.some((cell) => cell !== ""));
}

// Converts headers and row data into a formatted CSV string with Excel compatibility
export function jsonToCSV(headers: string[], rows: Array<(string | number | boolean | undefined | null)[]>): string {
  const sanitize = (val: any) => {
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.join(",");
  const rowLines = rows.map((row) => row.map(sanitize).join(","));
  return [headerLine, ...rowLines].join("\n");
}

// Download Trigger
export function downloadCSVFile(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // UTF-8 BOM for Excel compatibility
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- CSV TRANSLATIONS ---

// 1. Export Employees
export function exportEmployeesToCSV(employees: Employee[]) {
  const headers = [
    "Employee ID",
    "Full Name",
    "Password",
    "Designation",
    "Hourly Rate",
    "Phone",
    "Email",
    "Work Start",
    "Work End",
    "OT Start",
    "OT End"
  ];

  const rows = employees.map((e) => [
    e.emp_id,
    e.name,
    e.password || "",
    e.role || "",
    e.hourly_rate || 0,
    e.phone || "",
    e.email || "",
    e.work_start || "09:00",
    e.work_end || "18:00",
    e.ot_start || "18:00",
    e.ot_end || "22:00"
  ]);

  const csv = jsonToCSV(headers, rows);
  downloadCSVFile(`WorkSync_Employees_${new Date().toISOString().slice(0,10)}.csv`, csv);
}

// 2. Import Employees from CSV
export function importEmployeesFromCSV(fileContent: string): Employee[] {
  const parsed = parseCSV(fileContent);
  if (parsed.length <= 1) return [];

  // Match headers case-insensitively or fall back to index matching
  const headers = parsed[0].map(h => h.toLowerCase());
  const list: Employee[] = [];

  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 2) continue; // Skip bad row

    // Resolve positions
    const emp_id = row[0];
    const name = row[1];
    if (!emp_id || !name) continue; // ID and Name are compulsory

    const password = row[2] || "1234";
    const role = row[3] || "";
    const hourly_rate = row[4] ? Number(row[4]) : 0;
    const phone = row[5] || "";
    const email = row[6] || "";
    const work_start = row[7] || "09:00";
    const work_end = row[8] || "18:00";
    const ot_start = row[9] || "18:00";
    const ot_end = row[10] || "22:00";

    list.push({
      emp_id,
      name,
      password,
      role,
      hourly_rate: isNaN(hourly_rate) ? 0 : hourly_rate,
      phone,
      email,
      work_start,
      work_end,
      ot_start,
      ot_end
    });
  }

  return list;
}

// 3. Export Attendance Logs
export function exportAttendanceToCSV(attendance: AttendanceRec[], employees: Employee[]) {
  const headers = [
    "Record ID",
    "Date",
    "Employee ID",
    "Employee Name",
    "Check-In Time",
    "Check-Out Time",
    "Shift Mode",
    "Verification Method",
    "Check-In Confidence (%)",
    "Check-Out Confidence (%)",
    "Is Overtime",
    "Is Impostor",
    "Note"
  ];

  const rows = attendance.map((a) => {
    const emp = employees.find((e) => e.emp_id === a.emp_id);
    return [
      a.id,
      a.date,
      a.emp_id,
      emp ? emp.name : "Unknown",
      a.check_in || "",
      a.check_out || "",
      a.is_ot ? "Overtime" : "Regular",
      a.method,
      a.checkin_conf || "",
      a.checkout_conf || "",
      a.is_ot ? "TRUE" : "FALSE",
      a.is_impostor ? "TRUE" : "FALSE",
      a.note || ""
    ];
  });

  const csv = jsonToCSV(headers, rows);
  downloadCSVFile(`WorkSync_Attendance_${new Date().toISOString().slice(0,10)}.csv`, csv);
}

// 4. Import Attendance Logs from CSV
export function importAttendanceFromCSV(fileContent: string): AttendanceRec[] {
  const parsed = parseCSV(fileContent);
  if (parsed.length <= 1) return [];

  const list: AttendanceRec[] = [];

  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 3) continue; // Needs at least ID, Date, Employee ID

    const id = row[0] || `att_${Date.now()}_${i}`;
    const date = row[1];
    const emp_id = row[2];
    if (!date || !emp_id) continue;

    const check_in = row[4] || undefined;
    const check_out = row[5] || undefined;
    const is_ot = row[10] === "TRUE" || row[6] === "Overtime";
    const method = (row[7] === "face" || row[7] === "manual" || row[7] === "pin") ? row[7] : "manual";
    const checkin_conf = row[8] ? Number(row[8]) : undefined;
    const checkout_conf = row[9] ? Number(row[9]) : undefined;
    const is_impostor = row[11] === "TRUE";
    const note = row[12] || "";

    list.push({
      id,
      date,
      emp_id,
      check_in,
      check_out,
      method,
      is_ot,
      is_impostor,
      checkin_conf: isNaN(checkin_conf as number) ? undefined : checkin_conf,
      checkout_conf: isNaN(checkout_conf as number) ? undefined : checkout_conf,
      note
    });
  }

  return list;
}

// 5. Export Payroll Month Calculations
export interface PayrollCSVRow {
  month: string;
  emp_id: string;
  name: string;
  hourly_rate: number;
  days_worked: number;
  regular_hours: string;
  ot_hours: string;
  regular_pay: number;
  ot_pay: number;
  total_net: number;
  status: string;
}

export function exportPayrollToCSV(month: string, rowsData: PayrollCSVRow[]) {
  const headers = [
    "Month",
    "Employee ID",
    "Employee Name",
    "Hourly Rate",
    "Days Worked",
    "Regular Hours Worked",
    "Overtime Hours Worked",
    "Regular Pay",
    "Overtime Premium Pay",
    "Total Net Earnings",
    "Payment Status"
  ];

  const rows = rowsData.map((p) => [
    p.month,
    p.emp_id,
    p.name,
    p.hourly_rate,
    p.days_worked,
    p.regular_hours,
    p.ot_hours,
    p.regular_pay,
    p.ot_pay,
    p.total_net,
    p.status
  ]);

  const csv = jsonToCSV(headers, rows);
  downloadCSVFile(`WorkSync_Payroll_${month}.csv`, csv);
}
