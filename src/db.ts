/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = "WorkSync_Offline_DB";
const DB_VERSION = 1;

export interface Employee {
  emp_id: string;
  name: string;
  password?: string;
  role?: string;
  phone?: string;
  email?: string;
  photo?: string; // base64
  hourly_rate?: number;
  work_start?: string; // HH:MM
  work_end?: string; // HH:MM
  ot_start?: string; // HH:MM
  ot_end?: string; // HH:MM
  face_descriptor?: number[] | Record<string, number>;
}

export interface AttendanceRec {
  id: string; // `${emp_id}_${date}_${is_ot ? "OT" : "REG"}`
  emp_id: string;
  date: string; // YYYY-MM-DD
  check_in?: string; // HH:MM
  check_out?: string; // HH:MM
  method: "face" | "manual" | "pin";
  is_ot?: boolean;
  is_impostor?: boolean;
  checkin_photo?: string; // base64
  checkout_photo?: string; // base64
  proof_photo?: string; // base64 for unregistered attempts
  checkin_conf?: number;
  checkout_conf?: number;
  note?: string;
}

export interface PaymentRec {
  id: string;
  emp_id: string;
  month: string; // YYYY-MM
  amount: number;
  paid_at: string; // ISO String
  note?: string;
}

export interface Settings {
  globalWorkStart: string;
  globalWorkEnd: string;
  globalOTStart: string;
  globalOTEnd: string;
  currency: string;
  otMultiplier: number;
}

const DEFAULT_SETTINGS: Settings = {
  globalWorkStart: "09:00",
  globalWorkEnd: "18:00",
  globalOTStart: "18:00",
  globalOTEnd: "22:00",
  currency: "₹",
  otMultiplier: 1.5,
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error("IndexedDB error:", e);
      reject(new Error("Unable to open local IndexedDB store."));
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("employees")) {
        db.createObjectStore("employees", { keyPath: "emp_id" });
      }
      if (!db.objectStoreNames.contains("attendance")) {
        db.createObjectStore("attendance", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("payments")) {
        db.createObjectStore("payments", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
    };
  });

  return dbPromise;
}

// Helper to perform a transaction
async function getStore(
  storeName: "employees" | "attendance" | "payments" | "settings",
  mode: "readonly" | "readwrite"
): Promise<IDBObjectStore> {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// --- EMPLOYEES CRUD ---
export async function getEmployees(): Promise<Employee[]> {
  try {
    const store = await getStore("employees", "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("getEmployees fail", error);
    return [];
  }
}

export async function saveEmployee(emp: Employee): Promise<void> {
  const store = await getStore("employees", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(emp);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEmployee(emp_id: string): Promise<void> {
  const store = await getStore("employees", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(emp_id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- ATTENDANCE CRUD ---
export async function getAttendance(): Promise<AttendanceRec[]> {
  try {
    const store = await getStore("attendance", "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("getAttendance fail", error);
    return [];
  }
}

export async function saveAttendance(rec: AttendanceRec): Promise<void> {
  const store = await getStore("attendance", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAttendance(id: string): Promise<void> {
  const store = await getStore("attendance", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- PAYMENTS CRUD ---
export async function getPayments(): Promise<PaymentRec[]> {
  try {
    const store = await getStore("payments", "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("getPayments fail", error);
    return [];
  }
}

export async function savePayment(rec: PaymentRec): Promise<void> {
  const store = await getStore("payments", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deletePayment(id: string): Promise<void> {
  const store = await getStore("payments", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- SETTINGS ---
export async function getSettings(): Promise<Settings> {
  try {
    const store = await getStore("settings", "readonly");
    return new Promise((resolve) => {
      const req = store.get(1);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.data });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch (error) {
    console.error("getSettings fail", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(data: Settings): Promise<void> {
  const store = await getStore("settings", "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put({ id: 1, data });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Seed Database tool with initial dummy data if empty to quickly showcase face capability
export async function seedInitialDataIfNew(): Promise<boolean> {
  const list = await getEmployees();
  if (list.length > 0) return false;

  const dummyEmployees: Employee[] = [
    {
      emp_id: "EMP001",
      name: "Alex Rivera",
      password: "1111",
      role: "Operations Director",
      hourly_rate: 650,
      phone: "+91 98765 43210",
      email: "alex@worksync.com",
      work_start: "09:00",
      work_end: "18:00",
      ot_start: "18:00",
      ot_end: "22:00",
    },
    {
      emp_id: "EMP002",
      name: "Sarah Chen",
      password: "2222",
      role: "Lead UI Craftsman",
      hourly_rate: 450,
      phone: "+91 99887 76655",
      email: "sarah@worksync.com",
      work_start: "09:00",
      work_end: "18:00",
      ot_start: "18:00",
      ot_end: "21:00",
    }
  ];

  for (const emp of dummyEmployees) {
    await saveEmployee(emp);
  }

  // Pre-seed some dummy attendance records for today or past days
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const dummyAttendance: AttendanceRec[] = [
    {
      id: "EMP001_" + todayDateStr + "_REG",
      emp_id: "EMP001",
      date: todayDateStr,
      check_in: "09:02",
      check_out: "18:05",
      method: "manual",
      is_ot: false,
      checkin_conf: 100,
      checkout_conf: 100,
      note: "Automatic seed entry",
    }
  ];

  for (const att of dummyAttendance) {
    await saveAttendance(att);
  }

  return true;
}
