/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, AttendanceRec, Settings } from "./db";

// Convert "HH:MM" format to minutes from midnight
export function t2m(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

// Format minutes to custom readable string "Xh Ym"
export function mins2hm(m: number): string {
  if (!m && m !== 0) return "--";
  const s = m < 0 ? "-" : "";
  const a = Math.abs(m);
  return `${s}${Math.floor(a / 60)}h ${a % 60}m`;
}

// Get daily date strings safely offset by index
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Retrieve current "HH:MM"
export function nowTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
}

// Retrieve current "YYYY-MM-DD"
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Formats number into locale-aware currency representation
export function fmtCur(n: number, cur: string): string {
  return `${cur || "₹"}${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Extract hours matching employee schedule preference, with global fallbacks
export function empHours(emp: Employee, s: Settings) {
  return {
    ws: emp.work_start || s.globalWorkStart || "09:00",
    we: emp.work_end || s.globalWorkEnd || "18:00",
    ots: emp.ot_start || s.globalOTStart || "18:00",
    ote: emp.ot_end || s.globalOTEnd || "22:00",
  };
}

// Calculates worked hours, overtime, and estimated payment for a single record
export function calcRec(
  r: AttendanceRec,
  emp: Employee,
  s: Settings
) {
  if (!r.check_in || !r.check_out) return null;
  const { ws, we, ots, ote } = empHours(emp, s);

  let regMins = t2m(we) - t2m(ws);
  if (regMins < 0) regMins += 24 * 60;

  let otLimitMins = t2m(ote) - t2m(ots);
  if (otLimitMins < 0) otLimitMins += 24 * 60;

  let workedMins = t2m(r.check_out) - t2m(r.check_in);
  if (workedMins < 0) workedMins += 24 * 60;

  if (workedMins < 0) workedMins = 0;
  if (regMins < 0) regMins = 0;
  if (otLimitMins < 0) otLimitMins = 0;

  // Regular hours or overtime shift
  const regWorked = r.is_ot ? 0 : Math.min(workedMins, regMins);
  const otMins = r.is_ot ? Math.min(workedMins, otLimitMins) : 0;

  const hr = emp.hourly_rate || 0;
  const regPay = hr * (regWorked / 60);

  const multiplier = s.otMultiplier !== undefined ? s.otMultiplier : 1.5;
  const otPay = hr * (otMins / 60) * multiplier;

  const netPay = Math.max(0, regPay + otPay);

  return {
    workedMins,
    regWorked,
    otMins,
    regPay,
    otPay,
    netPay,
  };
}

// Aggregates an employee's total month earnings, hours, and attendance count
export function calcEmpPay(
  emp: Employee,
  attendance: AttendanceRec[],
  s: Settings,
  start: string,
  end: string
) {
  const recs = attendance.filter(
    (a) =>
      a.emp_id === emp.emp_id &&
      !a.is_impostor &&
      a.date >= start &&
      a.date <= end &&
      a.check_in &&
      a.check_out
  );

  let tW = 0;
  let tOT = 0;
  let tReg = 0;
  let tOTPay = 0;
  let tNet = 0;

  const daily = recs
    .map((r) => {
      const c = calcRec(r, emp, s);
      if (!c) return null;
      tW += c.workedMins;
      tOT += c.otMins;
      tReg += c.regPay;
      tOTPay += c.otPay;
      tNet += c.netPay;
      return { ...r, ...c };
    })
    .filter(Boolean) as Array<AttendanceRec & { workedMins: number; regWorked: number; otMins: number; regPay: number; otPay: number; netPay: number }>;

  return {
    daily,
    totalWorked: tW,
    totalOT: tOT,
    totalRegPay: tReg,
    totalOTPay: tOTPay,
    totalNet: Math.max(0, tNet),
    days: recs.length,
  };
}

// Local cache breach reports
export function pushAlert(msg: string) {
  try {
    const a = JSON.parse(localStorage.getItem("ws_alerts") || "[]");
    a.unshift({ id: Date.now(), msg, ts: new Date().toISOString(), read: false });
    localStorage.setItem("ws_alerts", JSON.stringify(a.slice(0, 50)));
  } catch (e) {
    console.error("pushAlert fail", e);
  }
}
