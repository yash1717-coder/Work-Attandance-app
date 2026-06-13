/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import * as db from "./db";
import { Employee, AttendanceRec, PaymentRec, Settings } from "./db";
import { Landing } from "./components/Landing";
import { AdminDash } from "./components/AdminDash";

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [payments, setPayments] = useState<PaymentRec[]>([]);
  const [settings, setSettings] = useState<Settings>({
    globalWorkStart: "09:00",
    globalWorkEnd: "18:00",
    globalOTStart: "18:00",
    globalOTEnd: "22:00",
    currency: "₹",
    otMultiplier: 1.5,
  });

  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbErr, setDbErr] = useState("");
  const [screen, setScreen] = useState<"landing" | "admin">("landing");
  const [adminUser, setAdminUser] = useState<{ id: string; name: string } | null>(null);

  // Core initialization and database sync loop
  const syncOfflineState = async () => {
    try {
      // 1. Initialize local IndexedDB tables
      await db.initDB();

      // 2. Pre-seed mock profiles alex and sarah if store is brand-new
      await db.seedInitialDataIfNew();

      // 3. Fetch fromIndexedDB stores
      const [empList, attList, payList, savedSets] = await Promise.all([
        db.getEmployees(),
        db.getAttendance(),
        db.getPayments(),
        db.getSettings(),
      ]);

      setEmployees(empList);
      setAttendance(attList);
      setPayments(payList);
      setSettings(savedSets);

      setOnline(true);
      setDbErr("");
    } catch (e: any) {
      console.error("IndexedDB Sync failure: ", e);
      setDbErr(e.message || "Initialization error");
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncOfflineState();
    // Keep local records clean and correlated on minor intervals
    const iv = setInterval(syncOfflineState, 4000);
    return () => clearInterval(iv);
  }, []);

  // --- CRUD DISPATCH METHODS FOR LOCAL INDEXEDDB PERSISTENCE ---

  const handleAddEmployee = async (emp: Employee) => {
    try {
      await db.saveEmployee(emp);
      // Immediately reflect in state
      setEmployees((prev) => [...prev.filter((e) => e.emp_id !== emp.emp_id), emp]);
    } catch (e: any) {
      console.error("handleAddEmployee error", e);
      throw new Error("Unable to save employee details to local storage.");
    }
  };

  const handleUpdateEmployee = async (emp_id: string, partial: Partial<Employee>) => {
    try {
      const match = employees.find((e) => e.emp_id === emp_id);
      if (!match) return;
      const updated = { ...match, ...partial };
      await db.saveEmployee(updated);
      setEmployees((prev) => prev.map((e) => (e.emp_id === emp_id ? updated : e)));
    } catch (e: any) {
      console.error("handleUpdateEmployee error", e);
      throw new Error("Unable to modify bio config parameters.");
    }
  };

  const handleDeleteEmployee = async (emp_id: string) => {
    try {
      await db.deleteEmployee(emp_id);
      setEmployees((prev) => prev.filter((e) => e.emp_id !== emp_id));
    } catch (e: any) {
      console.error("handleDeleteEmployee error", e);
      throw new Error("Unable to purge registration keys.");
    }
  };

  const handleAddAttendance = async (rec: AttendanceRec) => {
    try {
      await db.saveAttendance(rec);
      setAttendance((prev) => [...prev.filter((a) => a.id !== rec.id), rec]);
    } catch (e: any) {
      console.error("handleAddAttendance error", e);
      throw new Error("Unable to log attendance clocks.");
    }
  };

  const handleUpdateAttendance = async (id: string, partial: Partial<AttendanceRec>) => {
    try {
      const match = attendance.find((a) => a.id === id);
      if (!match) return;
      const updated = { ...match, ...partial } as AttendanceRec;
      await db.saveAttendance(updated);
      setAttendance((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      console.error("handleUpdateAttendance error", e);
      throw new Error("Unable to set session exit timestamp.");
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    try {
      await db.deleteAttendance(id);
      setAttendance((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      console.error("handleDeleteAttendance error", e);
      throw new Error("Purging record from table failed.");
    }
  };

  const handleSaveSettings = async (sets: Settings) => {
    try {
      await db.saveSettings(sets);
      setSettings(sets);
    } catch (e: any) {
      console.error("handleSaveSettings error", e);
      throw new Error("Saving global shift multi-timers failed.");
    }
  };

  const handleAddPayment = async (pay: PaymentRec) => {
    try {
      await db.savePayment(pay);
      setPayments((prev) => [...prev.filter((p) => p.id !== pay.id), pay]);
    } catch (e: any) {
      console.error("handleAddPayment error", e);
      throw new Error("Settling compensation payouts failed.");
    }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      await db.deletePayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error("handleDeletePayment error", e);
      throw new Error("Unable to rollback payout.");
    }
  };

  const handleAdminAccess = (matched: { id: string; name: string }) => {
    setAdminUser(matched);
    setScreen("admin");
  };

  const handleLogout = () => {
    setAdminUser(null);
    setScreen("landing");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-md font-bold tracking-wider text-slate-300">WORKSYNC OFFLINE</h2>
        <p className="text-xs text-slate-500 mt-1">Priming IndexedDB mobile containers...</p>
      </div>
    );
  }

  const sharedContext = {
    employees,
    attendance,
    payments,
    settings,
    online,
    loading,
    dbErr,
    addEmployee: handleAddEmployee,
    updateEmployee: handleUpdateEmployee,
    deleteEmployee: handleDeleteEmployee,
    addAttendance: handleAddAttendance,
    updateAttendance: handleUpdateAttendance,
    deleteAttendance: handleDeleteAttendance,
    saveSettings: handleSaveSettings,
    addPayment: handleAddPayment,
    deletePayment: handleDeletePayment,
    onLogout: handleLogout,
  };

  return screen === "landing" ? (
    <Landing {...sharedContext} onAdmin={handleAdminAccess} />
  ) : (
    <AdminDash {...sharedContext} admin={adminUser!} />
  );
}
