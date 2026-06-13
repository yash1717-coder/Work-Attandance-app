/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Employee, AttendanceRec, PaymentRec, Settings } from "../db";
import { StatusBar, Stat, Badge, Lightbox, CamView, MsgBox } from "./Shared";
import {
  t2m,
  mins2hm,
  addDays,
  nowTime,
  today,
  fmtCur,
  empHours,
  calcRec,
  calcEmpPay,
  pushAlert
} from "../utils";
import {
  exportEmployeesToCSV,
  importEmployeesFromCSV,
  exportAttendanceToCSV,
  importAttendanceFromCSV,
  exportPayrollToCSV,
  PayrollCSVRow
} from "../csvHelper";
import { loadFaceApi, getFaceDescriptor, matchFace } from "../faceRecognitionHelper";

interface AdminDashProps {
  admin: { id: string; name: string };
  employees: Employee[];
  attendance: AttendanceRec[];
  payments: PaymentRec[];
  settings: Settings;
  online: boolean;
  loading: boolean;
  dbErr: string;
  addEmployee: (emp: Employee) => Promise<void>;
  updateEmployee: (emp_id: string, partial: Partial<Employee>) => Promise<void>;
  deleteEmployee: (emp_id: string) => Promise<void>;
  addAttendance: (rec: AttendanceRec) => Promise<void>;
  updateAttendance: (id: string, partial: Partial<AttendanceRec>) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  saveSettings: (sets: Settings) => Promise<void>;
  addPayment: (pay: PaymentRec) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  onLogout: () => void;
}

export function AdminDash(props: AdminDashProps) {
  const [tab, setTab] = useState<string>("overview");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  // Poll local security alerts
  useEffect(() => {
    const fetchAlerts = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("ws_alerts") || "[]");
        setAlerts(stored);
      } catch {}
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 3000);
    return () => clearInterval(iv);
  }, []);

  const unreadAlerts = alerts.filter((a) => !a.read);

  function dismissAlert(id: number) {
    const n = alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
    setAlerts(n);
    localStorage.setItem("ws_alerts", JSON.stringify(n));
  }

  function dismissAllAlerts() {
    const n = alerts.map((a) => ({ ...a, read: true }));
    setAlerts(n);
    localStorage.setItem("ws_alerts", JSON.stringify(n));
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-gray-150 flex flex-col font-sans select-none pb-12">
      <StatusBar online={props.online} loading={false} dbErr="" />

      {/* Top Admin Header bar */}
      <header className="bg-[#121214]/90 border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-400 select-none">⬡ Admin Console</span>
          <span className="bg-indigo-500/10 text-indigo-400 font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase border border-indigo-500/20">
            {props.admin.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Security notifications bell */}
          <div className="relative">
            <button
               onClick={() => setShowAlerts(!showAlerts)}
               className={`p-2.5 rounded-xl border transition-all relative ${
                 unreadAlerts.length > 0
                   ? "bg-rose-950/20 border-rose-500/40 text-rose-350"
                   : "bg-[#1A1A1D] border-white/10 text-gray-400 hover:text-white"
               }`}
            >
              🔔
              {unreadAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full font-bold text-[9px] px-1.5 py-0.5 shadow-lg select-none">
                  {unreadAlerts.length}
                </span>
              )}
            </button>

            {showAlerts && (
              <div className="absolute right-0 mt-3 bg-[#121214] border border-white/5 rounded-2xl p-4 w-72 shadow-2xl z-50">
                <div className="flex justify-between items-center mb-3">
                  <strong className="text-[10px] tracking-wider uppercase text-gray-400">Security Breach Reports</strong>
                  {unreadAlerts.length > 0 && (
                    <button onClick={dismissAllAlerts} className="text-[10px] bg-[#1C1C1F] hover:bg-[#252529] border border-white/10 rounded px-2 py-0.5 text-gray-300">
                      Read All
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {alerts.length === 0 && (
                    <p className="text-gray-500 text-xs text-center py-4">No violations logged.</p>
                  )}
                  {alerts.map((a) => (
                    <div 
                      key={a.id} 
                      className={`p-2.5 border rounded-xl text-left transition-colors duration-250 ${
                        a.read ? "bg-[#0A0A0C]/40 border-white/5" : "bg-rose-950/20 border-rose-500/40"
                      }`}
                    >
                      <p className="text-xs leading-relaxed text-gray-300">{a.msg}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[9px] font-mono text-gray-550">{new Date(a.ts).toLocaleTimeString()}</span>
                        {!a.read && (
                          <button onClick={() => dismissAlert(a.id)} className="text-[9px] px-2 py-0.5 bg-[#1C1C1F] hover:bg-[#252529] border border-white/10 text-gray-200 rounded">
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={props.onLogout}
            className="border border-white/10 hover:border-white/20 bg-[#1A1A1D] text-gray-400 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Subtabs system */}
      <nav className="bg-[#121214] border-b border-white/5 px-3 py-1.5 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none sticky top-[53px] z-30 shadow-md">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "employees", label: "👥 Employee roster" },
          { id: "attendance", label: "📋 Attendance logs" },
          { id: "faceproofs", label: "🔍 Face Proofs" },
          { id: "facemanage", label: "🧠 Face reference keys" },
          { id: "facescan", label: "📷 Face Scan Terminal" },
          { id: "payroll", label: "💰 Payroll" },
          { id: "payments", label: "💳 Pay Payouts" },
          { id: "settings", label: "⚙️ Settings" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setShowAlerts(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow shadow-indigo-500/20 scale-[1.01]"
                : "text-gray-400 bg-transparent hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Main Tab components screen viewport */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 transition-all">
        {tab === "overview" && (
          <OverviewTab
            employees={props.employees}
            attendance={props.attendance}
            settings={props.settings}
            payments={props.payments}
          />
        )}

        {tab === "employees" && (
          <EmployeesTab
            employees={props.employees}
            settings={props.settings}
            addEmployee={props.addEmployee}
            updateEmployee={props.updateEmployee}
            deleteEmployee={props.deleteEmployee}
          />
        )}

        {tab === "attendance" && (
          <AttendanceTab
            employees={props.employees}
            attendance={props.attendance}
            settings={props.settings}
            updateAttendance={props.updateAttendance}
            deleteAttendance={props.deleteAttendance}
            addAttendance={props.addAttendance}
          />
        )}

        {tab === "faceproofs" && (
          <FaceProofsTab
            employees={props.employees}
            attendance={props.attendance}
            deleteAttendance={props.deleteAttendance}
          />
        )}

        {tab === "facemanage" && (
          <FaceManagerTab
            employees={props.employees}
            updateEmployee={props.updateEmployee}
          />
        )}

        {tab === "facescan" && (
          <FaceScanTerminalTab
            employees={props.employees}
            attendance={props.attendance}
            addAttendance={props.addAttendance}
            updateAttendance={props.updateAttendance}
            settings={props.settings}
          />
        )}

        {tab === "payroll" && (
          <PayrollTab
            employees={props.employees}
            attendance={props.attendance}
            settings={props.settings}
            payments={props.payments}
            addPayment={props.addPayment}
          />
        )}

        {tab === "payments" && (
          <PaymentsTab
            employees={props.employees}
            payments={props.payments}
            settings={props.settings}
            deletePayment={props.deletePayment}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            settings={props.settings}
            saveSettings={props.saveSettings}
          />
        )}
      </main>
    </div>
  );
}

// ── SUBTAB 1: OVERVIEW ──
function OverviewTab({ employees, attendance, settings, payments }: any) {
  const td = today();
  const todayRecs = attendance.filter((a: any) => a.date === td && !a.is_impostor);
  const checkedInCount = todayRecs.filter((a: any) => a.check_in && !a.check_out).length;
  const checkedOutCount = todayRecs.filter((a: any) => a.check_in && a.check_out).length;
  const absentCount = Math.max(0, employees.length - todayRecs.length);
  const impostorsToday = attendance.filter((a: any) => a.is_impostor && a.date === td).length;
  const cur = settings.currency || "₹";
  const thisMonth = td.slice(0, 7);

  const paidEmpIds = new Set(payments.filter((p: any) => p.month === thisMonth).map((p: any) => p.emp_id));
  const unpaidTotal = employees.reduce((sum: number, emp: any) => {
    if (paidEmpIds.has(emp.emp_id)) return sum;
    const { totalNet } = calcEmpPay(emp, attendance, settings, thisMonth + "-01", thisMonth + "-31");
    return sum + totalNet;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
        📅 Daily Dashboard — {td}
      </h2>

      {impostorsToday > 0 && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 flex items-center gap-4">
          <span className="text-3xl filter drop-shadow animate-bounce">🚨</span>
          <div>
            <h4 className="font-extrabold text-rose-350 text-sm">Security Breaches Captured Today</h4>
            <p className="text-xs text-rose-400 mt-1">
              There have been {impostorsToday} face verification failures logged. Review captured photos in "Face Proofs" tab.
            </p>
          </div>
        </div>
      )}

      {/* Grid count values */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total enrolled staff" value={employees.length} colorClass="border-sky-500 text-sky-400" icon="👥" />
        <Stat label="Active Inside Now" value={checkedInCount} colorClass="border-emerald-500 text-emerald-400" icon="🟢" />
        <Stat label="Fully Checked Out" value={checkedOutCount} colorClass="border-indigo-500 text-indigo-400" icon="✅" />
        <Stat label="Unaccounted Absent" value={absentCount} colorClass="border-rose-500 text-rose-400" icon="❌" />
      </div>

      <h2 className="text-xl font-bold tracking-tight text-slate-100 pt-4 flex items-center gap-2">
        💰 Monthly Finances — {thisMonth}
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Biometrics Registered" value={`${employees.filter((e: any) => e.face_descriptor).length}/${employees.length}`} colorClass="border-purple-500 text-purple-400" icon="🧠" />
        <Stat label="Security Blobs Caught" value={attendance.filter((a: any) => a.is_impostor).length} colorClass="border-rose-500 text-rose-400" icon="🚨" />
        <Stat label="Month Pending Payouts" value={fmtCur(unpaidTotal, cur)} colorClass="border-amber-500 text-amber-400" icon="💰" />
        <Stat label="Disbursed settlements" value={payments.filter((p: any) => p.month === thisMonth).length} colorClass="border-teal-500 text-teal-400" icon="💳" />
      </div>

      <h3 className="text-lg font-bold tracking-tight text-slate-100 pt-4">Recent Clocking Log</h3>
      {todayRecs.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center border border-slate-800 rounded-2xl bg-slate-900/40">No activity today yet.</p>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Employee</th>
                  <th className="p-4">In Time</th>
                  <th className="p-4">Out Time</th>
                  <th className="p-4">Shift Mode</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4 text-right">Estd. Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {todayRecs.map((r: any) => {
                  const emp = employees.find((e: any) => e.emp_id === r.emp_id);
                  const calc = emp ? calcRec(r, emp, settings) : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/20 text-slate-350">
                      <td className="p-4 font-semibold text-white">{emp?.name || r.emp_id}</td>
                      <td className="p-4 font-mono">{r.check_in || "—"}</td>
                      <td className="p-4 font-mono">{r.check_out || "—"}</td>
                      <td className="p-4">
                        <Badge label={r.is_ot ? "OT Shift" : "Regular"} type={r.is_ot ? "warning" : "default"} />
                      </td>
                      <td className="p-4">
                        <Badge label={r.method === "face" ? "facial map" : "pin passcode"} type={r.method === "face" ? "info" : "success"} />
                      </td>
                      <td className="p-4 font-mono">{calc ? mins2hm(calc.workedMins) : "—"}</td>
                      <td className="p-4 font-mono font-bold text-emerald-400 text-right">{calc ? fmtCur(calc.netPay, cur) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUBTAB 2: EMPLOYEES ROSTER ──
function EmployeesTab({ employees, settings, addEmployee, updateEmployee, deleteEmployee }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [csvAlert, setCsvAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const defForm = {
    name: "", emp_id: "", password: "", role: "", phone: "", email: "", photo: "",
    hourly_rate: "", work_start: "", work_end: "", ot_start: "", ot_end: ""
  };

  const [form, setForm] = useState(defForm);
  const [err, setErr] = useState("");

  function resetForm() {
    setForm(defForm);
    setEditId(null);
    setErr("");
  }

  function handlePhotoUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setForm((prev) => ({ ...prev, photo: e.target?.result as string }));
    r.readAsDataURL(f);
  }

  async function handleCsvImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const list = importEmployeesFromCSV(text);
        if (list.length === 0) {
          setCsvAlert({ msg: "❌ CSV file seems blank or cannot be decoded. Verify columns template.", type: "error" });
          return;
        }

        let imported = 0;
        for (const emp of list) {
          await addEmployee(emp);
          imported++;
        }
        setCsvAlert({ msg: `🎉 Success! Standard CSV parse executed. Imported ${imported} workers into IndexedDB store!`, type: "success" });
        setTimeout(() => setCsvAlert(null), 5000);
      } catch (err: any) {
        setCsvAlert({ msg: `❌ CSV Loader failure: ${err.message}`, type: "error" });
      }
    };
    r.readAsText(file);
    ev.target.value = ""; // clear
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.name || !form.emp_id || !form.password) {
      setErr("Full Name, ID Code and passcode are compulsory parameters.");
      return;
    }
    try {
      const payload = {
        ...form,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : 0,
      };

      if (!editId) {
        const exist = employees.some((x: any) => x.emp_id === form.emp_id);
        if (exist) {
          setErr("Employee ID already registered in database.");
          return;
        }
        await addEmployee(payload);
      } else {
        await updateEmployee(editId, payload);
      }
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          👥 Enrolled Personnel Roster ({employees.length})
        </h2>
        
        {/* CSV import/export triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportEmployeesToCSV(employees)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-250 border border-slate-800 text-xs py-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow transition-all hover:scale-102"
          >
            📥 Export CSV
          </button>
          
          <label className="bg-slate-900 hover:bg-slate-800 text-slate-250 border border-slate-800 text-xs py-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow transition-all hover:scale-102">
            📤 Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs py-2 px-4 rounded-xl cursor-pointer font-bold shadow transition-all hover:scale-102 flex items-center gap-1.5"
          >
            ➕ Register Staff
          </button>
        </div>
      </div>

      {csvAlert && <MsgBox msg={csvAlert.msg} type={csvAlert.type === "success" ? "success" : "error"} />}

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Snapshot</th>
                <th className="p-4">Name</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Designation</th>
                <th className="p-4">Base Rate</th>
                <th className="p-4">Daily Work Windows</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                    Roster is currently empty. Click "Register Staff" or "Import CSV" to add.
                  </td>
                </tr>
              ) : (
                employees.map((e: any) => (
                  <tr key={e.emp_id} className="hover:bg-slate-800/20 text-slate-350">
                    <td className="p-4">
                      {e.photo ? (
                        <img src={e.photo} className="w-10 h-10 rounded-full object-cover border border-slate-705 shadow" alt={e.name} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg select-none">
                          👤
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-black text-white text-sm">{e.name}</td>
                    <td className="p-4 font-mono text-sky-404 font-bold">{e.emp_id}</td>
                    <td className="p-4 text-xs font-semibold text-slate-300">{e.role || "—"}</td>
                    <td className="p-4 text-xs font-bold text-slate-300">{settings.currency || "₹"}{e.hourly_rate || 0}/hr</td>
                    <td className="p-4 text-[11px] leading-tight text-slate-400 font-sans">
                      <div className="flex items-center gap-1">
                        <span>💼 Reg:</span>
                        <span className="font-mono font-bold text-slate-205">{e.work_start || settings.globalWorkStart || "09:00"} - {e.work_end || settings.globalWorkEnd || "18:00"}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-purple-400">
                        <span>⏱️ OT:</span>
                        <span className="font-mono font-bold">{e.ot_start || settings.globalOTStart || "18:00"} - {e.ot_end || settings.globalOTEnd || "22:00"}</span>
                      </div>
                    </td>
                    <td className="p-4 text-[11px] leading-tight">
                      <p className="text-slate-300 font-mono font-bold">{e.phone || "—"}</p>
                      <p className="text-slate-500 mt-1">{e.email || "—"}</p>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setForm({
                            name: e.name || "",
                            emp_id: e.emp_id || "",
                            password: e.password || "",
                            role: e.role || "",
                            phone: e.phone || "",
                            email: e.email || "",
                            photo: e.photo || "",
                            hourly_rate: e.hourly_rate ? String(e.hourly_rate) : "",
                            work_start: e.work_start || "",
                            work_end: e.work_end || "",
                            ot_start: e.ot_start || "",
                            ot_end: e.ot_end || "",
                          });
                          setEditId(e.emp_id);
                          setShowForm(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 hover:text-white p-2 rounded-lg text-slate-300 border border-slate-700 transition-colors"
                        title="Edit details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete payroll records and biometrics reference for ${e.name}? This is irreversible.`)) {
                            deleteEmployee(e.emp_id);
                          }
                        }}
                        className="bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-200 border border-rose-900/40 p-2 rounded-lg transition-all"
                        title="Delete staff"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in backdrop-blur-sm">
          <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1">
              {editId ? "✏️ Edit Employee Configuration" : "👥 Create Staff Registration"}
            </h3>
            <p className="text-slate-400 text-xs mb-6">Setup payroll hourly rates, standard shifts parameters and security passcode PINs.</p>

            {err && <p className="text-rose-455 text-xs font-semibold bg-rose-950/30 border border-rose-800/45 px-3 py-2 rounded-lg mb-4">{err}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-505 tracking-wider uppercase block mb-1">Worker Full Name *</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. Liam Sterling"
                  value={form.name}
                  onChange={(ev) => { setForm({ ...form, name: ev.target.value }); setErr(""); }}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Designation Role</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. Store Attendant"
                  value={form.role}
                  onChange={(ev) => setForm({ ...form, role: ev.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Unique Employee ID Code *</label>
                <input
                  type="text"
                  disabled={!!editId}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50"
                  placeholder="e.g. EMP109"
                  value={form.emp_id}
                  onChange={(ev) => { setForm({ ...form, emp_id: ev.target.value }); setErr(""); }}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Numeric Passcode PIN (Fallback Check-In) *</label>
                <input
                  type="password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  placeholder="Min 4 numbers"
                  value={form.password}
                  onChange={(ev) => { setForm({ ...form, password: ev.target.value }); setErr(""); }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Hourly Compensation Rate ({settings.currency || "₹"})</label>
                <input
                  type="number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. 350"
                  value={form.hourly_rate}
                  onChange={(ev) => setForm({ ...form, hourly_rate: ev.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Staff Photo Portrait (base64)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full bg-transparent text-sm file:bg-slate-800 file:border-slate-800 file:text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:text-xs text-slate-500 cursor-pointer"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">Contact Phone</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="+91..."
                  value={form.phone}
                  onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-550 tracking-wider uppercase block mb-1">E-mail Address</label>
                <input
                  type="email"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="name@worksync.com"
                  value={form.email}
                  onChange={(ev) => setForm({ ...form, email: ev.target.value })}
                />
              </div>
            </div>

            <h4 className="text-xs font-bold text-sky-400 border-b border-slate-800 pb-1.5 mt-6 mb-3">Optional Scheduled Shifts Override</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase block mb-1">Reg Shift Starts</label>
                <input
                  type="time"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  value={form.work_start}
                  onChange={(ev) => setForm({ ...form, work_start: ev.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase block mb-1">Reg Shift Ends</label>
                <input
                  type="time"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  value={form.work_end}
                  onChange={(ev) => setForm({ ...form, work_end: ev.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-[10px] text-slate-505 uppercase block mb-1">OT Windows Starts</label>
                <input
                  type="time"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  value={form.ot_start}
                  onChange={(ev) => setForm({ ...form, ot_start: ev.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-505 uppercase block mb-1">OT Windows Ends</label>
                <input
                  type="time"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  value={form.ot_end}
                  onChange={(ev) => setForm({ ...form, ot_end: ev.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 pt-2">
              <button type="submit" className="flex-1 bg-sky-500 hover:bg-sky-450 text-slate-950 text-xs py-2.5 rounded-xl font-bold cursor-pointer border-none shadow">
                Save Record
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 bg-transparent border border-slate-850 text-slate-450 hover:text-slate-350 text-xs py-2.5 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── SUBTAB 3: ATTENDANCE LOGS ──
function AttendanceTab({ employees, attendance, settings, updateAttendance, deleteAttendance, addAttendance }: any) {
  const [fMonth, setFMonth] = useState(() => today().slice(0, 7));
  const [fDate, setFDate] = useState("");
  const [fEmp, setFEmp] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [csvAlert, setCsvAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const cur = settings.currency || "₹";

  const records = attendance
    .filter((a: any) => {
      if (a.is_impostor) return false;
      if (fMonth && !a.date.startsWith(fMonth)) return false;
      if (fDate && a.date !== fDate) return false;
      if (fEmp && a.emp_id !== fEmp) return false;
      return true;
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  // Dynamic collapsible Month index folders list
  const groupedMonths: Record<string, AttendanceRec[]> = {};
  const sortedMonthKeys: string[] = [];

  records.forEach((r: any) => {
    const mKey = r.date.slice(0, 7); // YYYY-MM
    if (!groupedMonths[mKey]) {
      groupedMonths[mKey] = [];
      sortedMonthKeys.push(mKey);
    }
    groupedMonths[mKey].push(r);
  });

  const getMonthLabel = (mKey: string) => {
    if (!mKey || mKey.length < 7) return mKey;
    const [year, mStr] = mKey.split("-");
    const mNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const idx = parseInt(mStr, 10) - 1;
    return idx >= 0 && idx < 12 ? `${mNames[idx]} ${year}` : mKey;
  };

  async function handleCsvImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const list = importAttendanceFromCSV(text);
        if (list.length === 0) {
          setCsvAlert({ msg: "❌ CSV file seems blank or column structure mismatch.", type: "error" });
          return;
        }

        let imported = 0;
        for (const att of list) {
          await addAttendance(att);
          imported++;
        }
        setCsvAlert({ msg: `🎉 Success! Imported ${imported} attendance sessions indices to local storage!`, type: "success" });
        setTimeout(() => setCsvAlert(null), 5000);
      } catch (err: any) {
        setCsvAlert({ msg: `❌ CSV Parse Error: ${err.message}`, type: "error" });
      }
    };
    r.readAsText(file);
    ev.target.value = ""; // clear
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          📋 Attendance Logs ledger ({records.length})
        </h2>

        {/* CSV export matches currently selected filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAttendanceToCSV(records, employees)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-250 border border-slate-800 text-xs py-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow transition-all hover:scale-102"
          >
            📥 Export CSV
          </button>

          <label className="bg-slate-900 hover:bg-slate-800 text-slate-250 border border-slate-800 text-xs py-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow transition-all hover:scale-102">
            📤 Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>
        </div>
      </div>

      {csvAlert && <MsgBox msg={csvAlert.msg} type={csvAlert.type === "success" ? "success" : "error"} />}

      {/* Filter toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end shadow-xl">
        <div>
          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5 block">Filter Month</label>
          <input
            type="month"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            value={fMonth}
            onChange={(e) => setFMonth(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5 block">Specific Day</label>
          <input
            type="date"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            value={fDate}
            onChange={(e) => setFDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5 block">Employee Select</label>
          <select
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            value={fEmp}
            onChange={(e) => setFEmp(e.target.value)}
          >
            <option value="">All Personnel</option>
            {employees.map((e: any) => (
              <option key={e.emp_id} value={e.emp_id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => { setFMonth(""); setFDate(""); setFEmp(""); }}
            className="w-full bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {sortedMonthKeys.length === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center border border-slate-800 rounded-2xl bg-slate-900/40">No records found matching triggers.</p>
      ) : (
        <div className="space-y-4">
          {sortedMonthKeys.map((mKey) => {
            const isCollapsed = collapsedMonths[mKey] || false;
            const monthRecs = groupedMonths[mKey];

            return (
              <div key={mKey} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                {/* Month header fold */}
                <div
                  onClick={() => setCollapsedMonths({ ...collapsedMonths, [mKey]: !isCollapsed })}
                  className="bg-slate-800/40 border-b border-slate-800 px-4 py-3 flex justify-between items-center cursor-pointer select-none"
                >
                  <span className="text-sm font-black text-sky-400 flex items-center gap-2">
                    📅 {getMonthLabel(mKey)}
                    <span className="bg-sky-400/10 text-sky-400 text-[10px] font-bold px-2 rounded-full border border-sky-400/20">
                      {monthRecs.length} record{monthRecs.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-slate-400 text-xs font-bold">
                    {isCollapsed ? "Expand ▼" : "Collapse ▲"}
                  </span>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto p-2">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Employee Name</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">In Time</th>
                          <th className="p-3">Out Time</th>
                          <th className="p-3">Shift Type</th>
                          <th className="p-3">Method</th>
                          <th className="p-3">Worked Hours</th>
                          <th className="p-3">Month Pay</th>
                          <th className="p-3">Captures</th>
                          <th className="p-3 text-right">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {monthRecs.map((r: any) => {
                          const emp = employees.find((e: any) => e.emp_id === r.emp_id);
                          const calc = emp ? calcRec(r, emp, settings) : null;

                          return (
                            <tr key={r.id} className="hover:bg-slate-800/10 text-slate-350">
                              <td className="p-3 font-semibold text-white">{emp?.name || r.emp_id}</td>
                              <td className="p-3 font-mono">{r.date}</td>
                              <td className="p-3 font-mono">{r.check_in || "—"}</td>
                              <td className="p-3 font-mono">{r.check_out || "—"}</td>
                              <td className="p-3">
                                <Badge label={r.is_ot ? "OT Shift" : "Regular"} type={r.is_ot ? "warning" : "default"} />
                              </td>
                              <td className="p-3">
                                <Badge label={r.method === "face" ? "facial map" : r.method === "pin" ? "pin" : "manual"} type={r.method === "face" ? "info" : "success"} />
                              </td>
                              <td className="p-3 font-mono">{calc ? mins2hm(calc.workedMins) : "—"}</td>
                              <td className="p-3 font-mono font-bold text-emerald-400">
                                {calc && emp?.hourly_rate ? fmtCur(calc.netPay, cur) : "—"}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2">
                                  {r.checkin_photo && (
                                    <div
                                      onClick={() => setPreview({ src: r.checkin_photo, label: `${emp?.name || r.emp_id} CHECK-IN Portrait • ${r.date} at ${r.check_in}` })}
                                      className="cursor-zoom-in group relative"
                                    >
                                      <img src={r.checkin_photo} className="w-8 h-8 rounded-lg object-cover border border-emerald-500/50 shadow" alt="in" />
                                      <p className="text-[9px] font-bold text-emerald-400 text-center select-none mt-0.5">IN</p>
                                    </div>
                                  )}
                                  {r.checkout_photo && (
                                    <div
                                      onClick={() => setPreview({ src: r.checkout_photo, label: `${emp?.name || r.emp_id} CHECK-OUT Portrait • ${r.date} at ${r.check_out}` })}
                                      className="cursor-zoom-in group"
                                    >
                                      <img src={r.checkout_photo} className="w-8 h-8 rounded-lg object-cover border border-rose-500/50 shadow" alt="out" />
                                      <p className="text-[9px] font-bold text-rose-450 text-center select-none mt-0.5">OUT</p>
                                    </div>
                                  )}
                                  {!r.checkin_photo && !r.checkout_photo && (
                                    <span className="text-slate-600 font-bold">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => {
                                    if (window.confirm("Verify deleting this clocking entry session?")) {
                                      deleteAttendance(r.id);
                                    }
                                  }}
                                  className="bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-200 border border-rose-950 p-1.5 rounded-lg text-xs"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Lightbox src={preview?.src || null} label={preview?.label || null} onClose={() => setPreview(null)} />
    </div>
  );
}

// ── SUBTAB 4: FACE PROOFS (INTRUDER CAPTURES) ──
function FaceProofsTab({ employees, attendance, deleteAttendance }: any) {
  const [filterType, setFilterType] = useState<string>("all");
  const [selDate, setSelDate] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const matchedLogs = attendance
    .filter((a: any) => {
      if (a.method !== "face" && !a.is_impostor) return false;
      if (filterType === "success" && a.is_impostor) return false;
      if (filterType === "failed" && !a.is_impostor) return false;
      if (selDate && a.date !== selDate) return false;
      return true;
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
        🔍 Security Logs &amp; Face verification Evidence
      </h2>
      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
        This ledger displays captured snapshots from biometric activities. Mismatches (intruders attempting fake sign-ins) trigger locked logs and warn triggers. Click cards to zoom-in.
      </p>

      {/* Proof headers controls */}
      <div className="flex flex-wrap items-center gap-3">
        {["all", "success", "failed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterType === f
                ? "bg-sky-500 text-slate-950 border-sky-500 font-extrabold shadow"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            {f === "all" ? "All biometrics triggers" : f === "success" ? "✅ Verified staff" : "🚨 suspicious intrusions"}
          </button>
        ))}

        <input
          type="date"
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs p-2 rounded-xl"
          value={selDate}
          onChange={(e) => setSelDate(e.target.value)}
        />
        {selDate && (
          <button onClick={() => setSelDate("")} className="text-xs text-sky-400 font-bold bg-transparent border-none">
            clear
          </button>
        )}
      </div>

      {matchedLogs.length === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center border border-slate-800 rounded-2xl bg-slate-900/40">No photo biometrics logged for selected date range.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {matchedLogs.map((rec: any) => {
            const emp = employees.find((e: any) => e.emp_id === rec.emp_id);
            const isF = rec.is_impostor;
            const photo64 = rec.checkin_photo || rec.proof_photo || rec.checkout_photo;

            return (
              <div
                key={rec.id}
                className={`border rounded-2xl p-4 bg-slate-900/50 shadow-lg flex flex-col justify-between hover:scale-[1.01] transition-all duration-200 ${
                  isF ? "border-rose-950 shadow-rose-900/5" : "border-emerald-950 shadow-emerald-500/5"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-lg">{isF ? "🚨" : "✅"}</span>
                      <strong className={`text-xs font-black uppercase tracking-wider ${isF ? "text-rose-400" : "text-emerald-400"}`}>
                        {isF ? "Intruder Alert" : "verified match"}
                      </strong>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">{rec.date} · {rec.check_in || "CLOCK"}</span>
                  </div>

                  {photo64 ? (
                    <div
                      onClick={() => setPreview({ src: photo64, label: `BIOMETRICS CARD index: ${rec.date} • Match distance accuracy: ${rec.checkin_conf || "75"}% • ID: ${rec.emp_id}` })}
                      className="cursor-zoom-in relative rounded-xl overflow-hidden border border-slate-700/50"
                    >
                      <img src={photo64} className="w-full h-40 object-cover shadow-inner" alt="verification camera target" />
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center text-slate-600 font-mono text-xs select-none">
                      (No Image Enrolled)
                    </div>
                  )}

                  <div className="mt-4 space-y-1.5 text-xs">
                    <p className="text-slate-400 text-[11px] font-semibold">
                      Registered ID Code: <span className="font-mono text-white text-xs">{rec.emp_id}</span>
                    </p>
                    <p className="text-slate-400 text-[11px] font-semibold">
                      Matched Profile:{" "}
                      {emp ? (
                        <span className="text-emerald-400 font-black">{emp.name}</span>
                      ) : (
                        <span className="text-rose-410 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase text-[9px]">unrecognized suspicious face</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-850">
                  <span className="text-[10px] bg-slate-950 text-slate-500 font-bold px-2 py-0.5 rounded-full border border-slate-850 uppercase">
                    Accuracy: {rec.checkin_conf || rec.checkout_conf || "90"}%
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this face proof capture entry completely?")) {
                        deleteAttendance(rec.id);
                      }
                    }}
                    className="bg-transparent border border-slate-800 hover:border-rose-900/40 text-slate-500 hover:text-rose-400 px-3 py-1 text-[11px] rounded-lg transition-colors cursor-pointer"
                  >
                    Delete Log
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Lightbox src={preview?.src || null} label={preview?.label || null} onClose={() => setPreview(null)} />
    </div>
  );
}

// ── SUBTAB 5: FACE REFERENCE MANAGER ──
function FaceManagerTab({ employees, updateEmployee }: any) {
  const [searchTxt, setSearchTxt] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [selEmp, setSelEmp] = useState("");
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const vRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const lists = employees.filter((e: any) =>
    !searchTxt ||
    e.name.toLowerCase().includes(searchTxt.toLowerCase()) ||
    e.emp_id.toLowerCase().includes(searchTxt.toLowerCase())
  );

  async function clearFingerprint(emp: any) {
    if (!window.confirm(`Delete registered face biometric coordinates from ${emp.name}? They won't matching checkins.`)) return;
    try {
      await updateEmployee(emp.emp_id, { face_descriptor: undefined });
      setMsg(`✅ Biometrics revoked successfully for ${emp.name}`);
      setMsgType("success");
    } catch (e: any) {
      setMsg(`❌ Error: ${e.message}`);
      setMsgType("error");
    }
  }

  async function startCam() {
    setMsg("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (vRef.current) {
        vRef.current.srcObject = s;
        await vRef.current.play();
      }
      setCamOn(true);
      setCaptured(null);
    } catch {
      setMsg("❌ Camera permissions denied or blocked.");
      setMsgType("error");
    }
  }

  function stopCam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamOn(false);
  }

  function grabSnapshot() {
    const cv = cvRef.current;
    const v = vRef.current;
    if (!cv || !v) return;
    cv.width = v.videoWidth;
    cv.height = v.videoHeight;
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.drawImage(v, 0, 0);
      setCaptured(cv.toDataURL("image/jpeg", 0.75));
    }
    stopCam();
  }

  function handleFileInput(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setCaptured(e.target?.result as string);
    r.readAsDataURL(f);
  }

  async function performEnrollment() {
    if (!selEmp) {
      setMsg("Select target employee profile.");
      setMsgType("error");
      return;
    }
    if (!captured) {
      setMsg("Retrieve a frontal photo portrait.");
      setMsgType("error");
      return;
    }

    setBusy(true);
    setMsg("⏳ Loading neural metrics & extracting biometrics face descriptor coordinates...");
    setMsgType("info");

    try {
      const img = new Image();
      const desc = await new Promise<number[] | null>((res) => {
        img.onload = async () => {
          try {
            const d = await getFaceDescriptor(img);
            res(d);
          } catch {
            res(null);
          }
        };
        img.onerror = () => res(null);
        img.src = captured;
      });

      if (!desc) {
        setMsg("❌ No recognizable face found in photo. Make sure portrait brightness is high and stand straight.");
        setMsgType("error");
        setBusy(false);
        return;
      }

      await updateEmployee(selEmp, { face_descriptor: desc, photo: captured });
      const empObj = employees.find((x: any) => x.emp_id === selEmp);
      setMsg(`🎉 Enrolls biometric success! Registered reference map for ${empObj?.name || selEmp}.`);
      setMsgType("success");

      setCaptured(null);
      setSelEmp("");
    } catch (e: any) {
      setMsg(`❌ DB write error: ${e.message}`);
      setMsgType("error");
    }
    setBusy(false);
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const enrolled = employees.filter((e: any) => e.face_descriptor);
  const pending = employees.filter((e: any) => !e.face_descriptor);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
        🧠 Face Registration &amp; Biometrics Keys Manager
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-905 border border-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex justify-between">
            <span>✅ Reference maps Registered ({enrolled.length})</span>
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {enrolled.length === 0 && <p className="text-slate-500 text-xs text-left py-2">None.</p>}
            {enrolled.map((e: any) => (
              <div key={e.emp_id} className="flex justify-between items-center text-xs p-1 pb-1.5 border-b border-slate-850 text-slate-300">
                <span>{e.name} (<code className="text-sky-400 font-bold">{e.emp_id}</code>)</span>
                <button
                  onClick={() => clearFingerprint(e)}
                  className="bg-transparent border-none text-rose-455 hover:underline cursor-pointer font-bold text-[10px] uppercase tracking-wide"
                >
                  revoke bio keys
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-905 border border-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-black text-rose-450 uppercase tracking-widest mb-3">
            <span>⚠️ Biometrics Missing ({pending.length})</span>
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {pending.length === 0 && <p className="text-slate-500 text-xs text-left py-2">All registered! 🎉</p>}
            {pending.map((e: any) => (
              <p key={e.emp_id} className="text-xs text-slate-300 border-b border-slate-850 p-1 pb-1.5">
                {e.name} (<code className="text-slate-500">{e.emp_id}</code>)
              </p>
            ))}
          </div>
        </div>
      </div>

      <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider pt-6">Enroll New worker Face Portrait</h3>
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1.5">Select Profile</label>
          <select
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-205"
            value={selEmp}
            onChange={(e) => setSelEmp(e.target.value)}
          >
            <option value="">-- Choose Employee --</option>
            {employees.map((e: any) => (
              <option key={e.emp_id} value={e.emp_id}>
                {e.name} (ID: {e.emp_id}) {e.face_descriptor ? " [✓ REG]" : ""}
              </option>
            ))}
          </select>
        </div>

        <CamView camOn={camOn} captured={captured} vRef={vRef} cvRef={cvRef} />

        <div className="flex flex-wrap gap-2 justify-center">
          {!camOn && !captured && (
            <>
              <button onClick={startCam} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer">
                📷 Open Camera
              </button>
              <button onClick={() => fileRef.current?.click()} className="bg-slate-850 hover:bg-slate-800 text-xs py-2.5 px-4 rounded-xl cursor-pointer border border-slate-755 text-slate-300">
                📁 Upload Photo
              </button>
            </>
          )}

          {camOn && (
            <>
              <button onClick={grabSnapshot} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 px-5 rounded-xl cursor-pointer border-none shadow">
                📸 SNAP PORTRAIT
              </button>
              <button onClick={stopCam} className="bg-slate-800 hover:bg-slate-750 text-xs py-2.5 px-4 rounded-xl cursor-pointer">
                Close
              </button>
            </>
          )}

          {captured && (
            <button onClick={() => setCaptured(null)} className="bg-slate-800 hover:bg-slate-750 text-xs py-2 px-4 rounded-xl cursor-pointer text-slate-360">
              🔄 Retake Snapshot
            </button>
          )}

          <input ref={fileRef as any} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
        </div>

        {captured && (
          <button
            disabled={busy || !selEmp}
            onClick={performEnrollment}
            className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-widest ${
              selEmp ? "bg-purple-600 hover:bg-purple-550 text-white cursor-pointer" : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            {busy ? "⌛ Reading metrics..." : "🧠 Register Reference face map"}
          </button>
        )}

        {msg && <MsgBox msg={msg} type={msgType === "success" ? "success" : msgType === "error" ? "error" : "info"} />}
      </div>
    </div>
  );
}

// ── SUBTAB 6: FACE SCAN TERMINAL DASHBOARD VIEW ──
function FaceScanTerminalTab({ employees, attendance, addAttendance, updateAttendance, settings }: any) {
  const [camOn, setCamOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [status, setStatus] = useState("⌛ Initializing Face-api library references...");
  const [shType, setShType] = useState<"regular" | "ot">("regular");

  const vRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadFaceApi().then((ok) => {
      if (ok) setStatus("🟢 Facial scanning algorithms online.");
      else setStatus("❌ Neural models fail. Verify active internet references.");
    });
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startTerminal() {
    setScanResult(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (vRef.current) {
        vRef.current.srcObject = s;
        await vRef.current.play();
      }
      setCamOn(true);
      setCaptured(null);
      setStatus("📸 Scanning live terminal grid. Look straight at the camera.");
    } catch {
      setStatus("❌ Webcam denied or blocked by frame constraints.");
    }
  }

  function stopTerminal() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamOn(false);
  }

  async function executeScanMatch() {
    const video = vRef.current;
    if (!video || video.videoWidth === 0) return;
    setProcessing(true);
    setStatus("⏳ Correlating descriptor lines...");

    const canvas = cvRef.current;
    if (!canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const snapshotUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCaptured(snapshotUrl);
    stopTerminal();

    try {
      const img = new Image();
      const faceDesc = await new Promise<number[] | null>((res) => {
        img.onload = async () => {
          try {
            const d = await getFaceDescriptor(img);
            res(d);
          } catch {
            res(null);
          }
        };
        img.onerror = () => res(null);
        img.src = snapshotUrl;
      });

      if (!faceDesc) {
        setScanResult({ ok: false, msg: "Frontal facial coordinates empty. Please center face." });
        setStatus("🔴 Scanning failed.");
        setProcessing(false);
        return;
      }

      const activeStaff = employees.filter((e: any) => e.face_descriptor);
      const matched = await matchFace(faceDesc, activeStaff);

      if (!matched) {
        const errorMsg = `🚨 UNRECOGNIZED ATTEMPT: False match block locked at ${nowTime()}`;
        pushAlert(errorMsg);

        await addAttendance({
          id: `FAIL_${today()}_SUS_${Date.now()}`,
          emp_id: "__unknown__",
          date: today(),
          check_in: nowTime(),
          method: "face",
          proof_photo: snapshotUrl,
          is_impostor: true,
          checkin_conf: 0
        });

        setScanResult({ ok: false, msg: "Access Blocked: Facial keys do not associate with any staff profile indices." });
        setStatus("🔴 Intruder captured!");
      } else {
        const { emp, dist } = matched;
        const accuracy = Math.round((1 - dist / 0.55) * 100);
        const td = today();
        const ts = nowTime();
        const isOT = shType === "ot";

        const yesterdayStr = addDays(td, -1);
        const myRecs = attendance.filter((a: any) => a.emp_id === emp.emp_id && !a.is_impostor);

        const openRecord = myRecs.find(
          (a: any) =>
            (isOT ? a.is_ot : !a.is_ot) &&
            !a.check_out &&
            (a.date === td || a.date === yesterdayStr)
        );

        if (!openRecord) {
          await addAttendance({
            id: `${emp.emp_id}_${td}_${isOT ? "OT" : "REG"}_${Date.now()}`,
            emp_id: emp.emp_id,
            date: td,
            check_in: ts,
            method: "face",
            is_ot: isOT,
            checkin_photo: snapshotUrl,
            checkin_conf: accuracy,
            is_impostor: false
          });
          setScanResult({ ok: true, msg: `Welcome back, ${emp.name}! Check-in verified successfully at ${ts}.` });
        } else {
          await updateAttendance(openRecord.id, {
            check_out: ts,
            checkout_photo: snapshotUrl,
            checkout_conf: accuracy
          });
          setScanResult({ ok: true, msg: `Goodbye, ${emp.name}! Check-out verified successfully at ${ts}.` });
        }
        setStatus("🟢 Match success!");
      }
    } catch (e: any) {
      setScanResult({ ok: false, msg: `System fault: ${e.message}` });
    }
    setProcessing(false);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-slate-100 text-center flex items-center justify-center gap-2">
        📷 Interactive biometric Scanner Dashboard
      </h2>

      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setShType("regular")}
          className={`px-4 py-2 text-xs font-bold rounded-xl border ${
            shType === "regular" ? "bg-sky-500 text-slate-950 border-sky-500" : "bg-slate-905 text-slate-400 border-slate-800"
          }`}
        >
          Regular Duties
        </button>
        <button
          onClick={() => setShType("ot")}
          className={`px-4 py-2 text-xs font-bold rounded-xl border ${
            shType === "ot" ? "bg-purple-650 text-white border-purple-500 bg-purple-600 shadow" : "bg-slate-905 text-slate-400 border-slate-800"
          }`}
        >
          Overtime Hours
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center space-y-4">
        <CamView camOn={camOn} captured={captured} vRef={vRef} cvRef={cvRef} />
        <p className="text-slate-400 font-mono text-xs">{status}</p>

        <div className="flex gap-3 justify-center">
          {!camOn && !processing && (
            <button onClick={startTerminal} className="bg-sky-500 hover:bg-sky-450 hover:scale-101 text-slate-950 px-5 py-3 font-extrabold text-xs rounded-xl border-none transition-all shadow select-none">
              Start terminal scanner loop
            </button>
          )}

          {camOn && !processing && (
            <>
              <button onClick={executeScanMatch} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-3 font-black text-xs rounded-xl border-none shadow transition-all">
                TRIGGER FACE MATCH SCAN
              </button>
              <button onClick={stopTerminal} className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-4 py-3 rounded-xl">
                Close
              </button>
            </>
          )}

          {captured && !processing && (
            <button onClick={startTerminal} className="bg-slate-800 hover:bg-slate-750 text-xs px-5 py-3 rounded-xl text-slate-350">
              Clear &amp; Scan Next Worker
            </button>
          )}
        </div>

        {scanResult && (
          <div className={`p-4 rounded-xl border text-sm font-bold ${
            scanResult.ok ? "bg-emerald-955/30 border-emerald-500/25 text-emerald-300" : "bg-rose-955/30 border-rose-500/25 text-rose-350"
          }`}>
            {scanResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SUBTAB 7: PAYROLL METRICS ──
interface PayrollTabProps {
  employees: Employee[];
  attendance: AttendanceRec[];
  settings: Settings;
  payments: PaymentRec[];
  addPayment: (pay: PaymentRec) => Promise<void>;
}

function PayrollTab({ employees, attendance, settings, payments, addPayment }: PayrollTabProps) {
  const [targetMonth, setTargetMonth] = useState(() => today().slice(0, 7));
  const [csvAlert, setCsvAlert] = useState<string | null>(null);

  const start = targetMonth + "-01";
  const end = targetMonth + "-31";
  const cur = settings.currency || "₹";

  const resolvedPayoutSet = new Set(payments.filter((p) => p.month === targetMonth).map((p) => p.emp_id));

  // Build rows data for export as well
  const resolvedRows: PayrollCSVRow[] = employees.map((emp) => {
    const isPaid = resolvedPayoutSet.has(emp.emp_id);
    const summary = calcEmpPay(emp, attendance, settings, start, end);
    return {
      month: targetMonth,
      emp_id: emp.emp_id,
      name: emp.name,
      hourly_rate: emp.hourly_rate || 0,
      days_worked: summary.days,
      regular_hours: mins2hm(summary.totalWorked - summary.totalOT),
      ot_hours: mins2hm(summary.totalOT),
      regular_pay: Number(summary.totalRegPay.toFixed(2)),
      ot_pay: Number(summary.totalOTPay.toFixed(2)),
      total_net: Number(summary.totalNet.toFixed(2)),
      status: isPaid ? "PAID" : "PENDING"
    };
  });

  async function dischargeEarning(emp: Employee, netAmount: number) {
    if (netAmount <= 0) {
      alert("Cannot dispatch blank salary.");
      return;
    }
    if (!window.confirm(`Disburse amount ${fmtCur(netAmount, cur)} as paid salary for ${emp.name} for the period: ${targetMonth}?`)) return;

    try {
      await addPayment({
        id: `${emp.emp_id}_${targetMonth}_${Date.now()}`,
        emp_id: emp.emp_id,
        month: targetMonth,
        amount: netAmount,
        paid_at: new Date().toISOString(),
        note: "Manual discharge payment settlement index"
      });
    } catch (e: any) {
      alert(`Fault index error: ${e.message}`);
    }
  }

  function handleExport() {
    exportPayrollToCSV(targetMonth, resolvedRows);
    setCsvAlert("🎉 Success! Exported Excel-compatible payroll calculation sheet.");
    setTimeout(() => setCsvAlert(null), 4000);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          💰 Custom Monthly Payroll Settlement Calculations
        </h2>

        <div className="flex items-center gap-2.5">
          <input
            type="month"
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
          />

          <button
            onClick={handleExport}
            className="bg-sky-500 hover:bg-sky-450 text-slate-950 font-black text-xs py-2 px-4 rounded-xl cursor-pointer hover:scale-102 flex items-center gap-1.5 transition-all shadow"
          >
            📋 Download Payroll sheet (CSV)
          </button>
        </div>
      </div>

      {csvAlert && <MsgBox msg={csvAlert} type="success" />}

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Staff details</th>
                <th className="p-4">Base Rate</th>
                <th className="p-4">Active Days</th>
                <th className="p-4">Regular hours</th>
                <th className="p-4 text-purple-400">OT hours</th>
                <th className="p-4">Base pay</th>
                <th className="p-4 text-purple-400">OT premium</th>
                <th className="p-4">total Net pay</th>
                <th className="p-4">Payment status</th>
                <th className="p-4 text-right">Settlement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">Configure staff in Roster first.</td>
                </tr>
              ) : (
                employees.map((emp: Employee) => {
                  const isPaid = resolvedPayoutSet.has(emp.emp_id);
                  const s = calcEmpPay(emp, attendance, settings, start, end);

                  return (
                    <tr key={emp.emp_id} className="hover:bg-slate-800/20 text-slate-350">
                      <td className="p-4 font-black text-slate-50">
                        {emp.name}
                        <span className="block italic text-[10px] text-slate-500 font-normal">ID: {emp.emp_id}</span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-300">{cur}{emp.hourly_rate || 0}/hr</td>
                      <td className="p-4 font-mono">{s.days} days</td>
                      <td className="p-4 font-mono">{mins2hm(s.totalWorked - s.totalOT)}</td>
                      <td className="p-4 font-mono text-purple-400">{mins2hm(s.totalOT)}</td>
                      <td className="p-4 font-mono text-slate-300">{fmtCur(s.totalRegPay, cur)}</td>
                      <td className="p-4 font-mono text-purple-400">{fmtCur(s.totalOTPay, cur)}</td>
                      <td className="p-4 font-mono font-black text-emerald-400 text-sm">{fmtCur(s.totalNet, cur)}</td>
                      <td className="p-4">
                        <Badge label={isPaid ? "Paid" : "Pending"} type={isPaid ? "success" : "warning"} />
                      </td>
                      <td className="p-4 text-right">
                        {isPaid ? (
                          <span className="text-[11px] text-slate-500 font-bold uppercase select-none mr-2">Disbursed ✓</span>
                        ) : (
                          <button
                            disabled={s.totalNet <= 0}
                            onClick={() => dischargeEarning(emp, s.totalNet)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans border-none transition-all mr-2 ${
                              s.totalNet > 0
                                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow"
                                : "bg-slate-850 text-slate-600 cursor-not-allowed"
                            }`}
                          >
                            Mark as Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── SUBTAB 8: PAYMENT SETTLEMENTS ──
function PaymentsTab({ employees, payments, settings, deletePayment }: any) {
  const [fMonth, setFMonth] = useState(() => today().slice(0, 7));

  const list = payments
    .filter((p: any) => !fMonth || p.month === fMonth)
    .sort((a: any, b: any) => b.paid_at.localeCompare(a.paid_at));

  const summedValues = list.reduce((a: number, c: any) => a + c.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          💳 Historical Salary Settlements
        </h2>

        <div className="flex items-center gap-2.5">
          <input
            type="month"
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl"
            value={fMonth}
            onChange={(e) => setFMonth(e.target.value)}
          />
          {fMonth && (
            <button onClick={() => setFMonth("")} className="text-xs text-sky-400 font-bold">
              Show All-Time
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center shadow-lg">
        <span className="text-xs text-slate-500 font-medium tracking-wider uppercase mb-1">Total Disbursed Payroll {fMonth ? `(${fMonth})` : "(All-Time)"}</span>
        <h3 className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{fmtCur(summedValues, settings.currency)}</h3>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Employee</th>
                <th className="p-4">Settled Month</th>
                <th className="p-4">Disbursed Amount</th>
                <th className="p-4">Discharge Timestamp</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Settlement Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">No settlements logged for this filter.</td>
                </tr>
              ) : (
                list.map((p: any) => {
                  const emp = employees.find((e: any) => e.emp_id === p.emp_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/20 text-slate-350">
                      <td className="p-4 font-black text-white">{emp?.name || p.emp_id}</td>
                      <td className="p-4 font-mono font-bold text-amber-400">{p.month}</td>
                      <td className="p-4 font-mono font-black text-emerald-400">{fmtCur(p.amount, settings.currency)}</td>
                      <td className="p-4 font-mono text-slate-300">{new Date(p.paid_at).toLocaleString()}</td>
                      <td className="p-4 text-slate-400">{p.note || "—"}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm("Perform payment transaction rollback? Disbursed amount will revert to outstanding debt.")) {
                              deletePayment(p.id);
                            }
                          }}
                          className="bg-transparent border border-slate-800 hover:border-rose-900 hover:bg-rose-900/10 text-slate-500 hover:text-rose-455 p-1.5 rounded-lg text-[10px] font-bold uppercase"
                        >
                          Rollback
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── SUBTAB 9: SETTINGS ──
function SettingsTab({ settings, saveSettings }: any) {
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
        ⚙️ Global System Configuration Parameters
      </h2>

      <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1.5">Currency Symbol</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            value={form.currency || "₹"}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1.5">Reg Shift Start Time</label>
            <input
              type="time"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.globalWorkStart || "09:00"}
              onChange={(e) => setForm({ ...form, globalWorkStart: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1.5">Reg Shift End Time</label>
            <input
              type="time"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.globalWorkEnd || "18:00"}
              onChange={(e) => setForm({ ...form, globalWorkEnd: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-505 block uppercase mb-1.5">OT hours Start time</label>
            <input
              type="time"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.globalOTStart || "18:00"}
              onChange={(e) => setForm({ ...form, globalOTStart: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-505 block uppercase mb-1.5">OT hours End time</label>
            <input
              type="time"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
              value={form.globalOTEnd || "22:00"}
              onChange={(e) => setForm({ ...form, globalOTEnd: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-505 block uppercase mb-1.5">Overtime rate Factor multiplier</label>
          <input
            type="number"
            step="0.1"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
            value={form.otMultiplier || 1.5}
            onChange={(e) => setForm({ ...form, otMultiplier: Number(e.target.value) || 1.5 })}
          />
        </div>

        <button type="submit" className="w-full bg-sky-505 bg-sky-500 hover:bg-sky-450 hover:scale-[1.01] text-slate-950 font-extrabold text-xs py-3.5 rounded-xl border-none transition-all shadow">
          Save Configuration parameters
        </button>

        {saved && (
          <p className="text-emerald-400 font-bold text-xs mt-2 text-center animate-pulse">
            ✅ Parameters saved directly inside IndexedDB cache.
          </p>
        )}
      </form>
    </div>
  );
}
