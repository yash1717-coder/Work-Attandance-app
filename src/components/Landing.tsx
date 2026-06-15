/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Employee, AttendanceRec, Settings } from "../db";
import { CamView, Badge } from "./Shared";
import { loadFaceApi, getFaceDescriptor, matchFace } from "../faceRecognitionHelper";
import { nowTime, today, addDays, pushAlert } from "../utils";

interface LandingProps {
  employees: Employee[];
  attendance: AttendanceRec[];
  settings: Settings;
  online: boolean;
  loading: boolean;
  dbErr: string;
  addAttendance: (rec: AttendanceRec) => Promise<void>;
  updateAttendance: (id: string, partial: Partial<AttendanceRec>) => Promise<void>;
  onAdmin: (matched: { id: string; name: string }) => void;
}

const ADMINS = [
  { id: "Admin01", password: "Admin111", name: "System Administrator One" },
  { id: "Admin02", password: "Admin222", name: "System Administrator Two" },
];

export function Landing({
  employees,
  attendance,
  settings,
  online,
  loading,
  dbErr,
  addAttendance,
  updateAttendance,
  onAdmin,
}: LandingProps) {
  // Navigation & admin login states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [aId, setAId] = useState("");
  const [aPw, setAPw] = useState("");
  const [adminErr, setAdminErr] = useState("");

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if building under standalone frame
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User responded to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Kiosk Scanner Mode States
  const [isKiosk, setIsKiosk] = useState(false);
  const [shiftType, setShiftType] = useState<"regular" | "ot">("regular");
  const [modelState, setModelState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [camOn, setCamOn] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Camera permissions & fallback selection states
  const [camError, setCamError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");

  // Scan Verification results
  const [scanResult, setScanResult] = useState<{
    ok: boolean;
    action?: "Check-In" | "Check-Out";
    emp?: Employee;
    conf?: number;
    time?: string;
    photoSrc?: string;
    msg: string;
  } | null>(null);

  const [counter, setCounter] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const vRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load Face Recognition models on active demand
  useEffect(() => {
    setModelState("loading");
    loadFaceApi().then((ok) => {
      if (ok) {
        setModelState("ready");
      } else {
        setModelState("failed");
      }
    });
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Enter/Exit Kiosk triggering automatic camera start
  useEffect(() => {
    if (isKiosk && modelState === "ready" && !fallbackMode) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isKiosk, modelState, fallbackMode]);

  // Handle countdown timer auto return
  useEffect(() => {
    if (scanResult) {
      const waitTime = scanResult.ok ? 8 : 4;
      setCounter(waitTime);

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setCounter((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setScanResult(null);
            if (isKiosk && !fallbackMode) {
              startCamera();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scanResult, isKiosk, fallbackMode]);

  // Admin Verification Login
  function doAdminLogin() {
    const matched = ADMINS.find((x) => x.id === aId && x.password === aPw);
    if (matched) {
      setAdminErr("");
      setShowAdminModal(false);
      onAdmin(matched);
      setAId("");
      setAPw("");
    } else {
      setAdminErr("Invalid authentication login credentials.");
    }
  }

  // Camera Management
  async function startCamera() {
    setCamError(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch {
        // Broad capture safety parameters
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (vRef.current) {
        vRef.current.srcObject = stream;
        await vRef.current.play();
      }
      setCamOn(true);
      setCamError(null);
    } catch (e: any) {
      console.error("Camera stream blocked.", e);
      setCamError(e ? e.message : "Permission Access Denied.");
      // Fallback automatically to selection PIN index
      setFallbackMode(true);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamOn(false);
  }

  // Manual fallback selection submission with custom PIN check
  async function handleManualKioskVerify() {
    if (!selectedEmpId) return;
    const emp = employees.find((e) => e.emp_id === selectedEmpId);
    if (!emp) return;

    const userPin = prompt(`Enter security passcode/password for ${emp.name} to check in/out:`);
    if (userPin === null) return; // cancelled

    if (emp.password && userPin !== emp.password) {
      alert("❌ Incorrect employee passcode pattern. Authentication failed.");
      return;
    }

    setProcessing(true);
    const td = today();
    const ts = nowTime();
    const isOT = shiftType === "ot";

    try {
      const yesterdayStr = addDays(td, -1);
      const myRecs = attendance.filter((a) => a.emp_id === emp.emp_id && !a.is_impostor);

      const openRecord = myRecs.find(
        (a) =>
          (isOT ? a.is_ot : !a.is_ot) &&
          !a.check_out &&
          (a.date === td || a.date === yesterdayStr)
      );

      if (!openRecord) {
        const recordId = `${emp.emp_id}_${td}_${isOT ? "OT" : "REG"}_${Date.now()}`;
        await addAttendance({
          id: recordId,
          emp_id: emp.emp_id,
          date: td,
          check_in: ts,
          method: "pin",
          is_ot: isOT,
          checkin_photo: emp.photo,
          checkin_conf: 100,
        });

        setScanResult({
          ok: true,
          action: "Check-In",
          emp,
          conf: 100,
          time: ts,
          msg: `🟢 Welcome, ${emp.name}! Regular Check-IN via PIN verified successfully at ${ts}.`,
        });
      } else {
        await updateAttendance(openRecord.id, {
          check_out: ts,
          checkout_conf: 100,
        });

        setScanResult({
          ok: true,
          action: "Check-Out",
          emp,
          conf: 100,
          time: ts,
          msg: `🔴 Goodbye, ${emp.name}! Standard Check-OUT via PIN registered successfully at ${ts}.`,
        });
      }
    } catch (e: any) {
      console.error(e);
      setScanResult({
        ok: false,
        msg: `❌ Save failure: ${e.message}`,
      });
    }
    setProcessing(false);
  }

  // AI Biometric Check-In/Out Capture and Match Flow
  async function handleKioskBiometricScan() {
    if (modelState !== "ready") {
      alert("Biometric AI engine not loaded. Please wait...");
      return;
    }
    const video = vRef.current;
    const canvas = cvRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      alert("Camera feed not warm yet. Align face inside container.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const snapshot = canvas.toDataURL("image/jpeg", 0.75);
    stopCamera();
    setProcessing(true);

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
        img.src = snapshot;
      });

      if (!faceDesc) {
        setProcessing(false);
        setScanResult({
          ok: false,
          msg: "🚫 Facial features not captured! Stand straight under good brightness and try scanning again.",
        });
        return;
      }

      // Filter users possessing active bio reference descriptors
      const enrolledStaff = employees.filter((e) => e.face_descriptor);
      const matched = await matchFace(faceDesc, enrolledStaff);

      const td = today();
      const ts = nowTime();
      const isOT = shiftType === "ot";

      if (!matched) {
        // Intruder scan trigger logged to locally persistent IndexedDB record
        const failId = `FAIL_${td}_UNKNOWN_${Date.now()}`;
        pushAlert(`🚨 SECURITY NOTICE: Unregistered visitor facial scan failed login validation today.`);
        
        await addAttendance({
          id: failId,
          emp_id: "__unknown__",
          date: td,
          check_in: ts,
          check_out: ts,
          method: "face",
          is_impostor: true,
          proof_photo: snapshot,
          note: "Kiosk match mismatch intruder block logs",
        });

        setProcessing(false);
        setScanResult({
          ok: false,
          msg: "🚫 Identification Failed: Face biometric coordinates do not match any enrolled personnel database.",
        });
        return;
      }

      // Success match!
      const emp = matched.emp;
      const conf = Math.round(Math.max(0, Math.min(100, (1 - matched.dist / 0.55) * 100)));

      // Find if this employee is currently checked in (open attendance record today/yesterday)
      const yesterdayStr = addDays(td, -1);
      const myRecs = attendance.filter((a) => a.emp_id === emp.emp_id && !a.is_impostor);

      const openRecord = myRecs.find(
        (a) =>
          (isOT ? a.is_ot : !a.is_ot) &&
          !a.check_out &&
          (a.date === td || a.date === yesterdayStr)
      );

      if (!openRecord) {
        const recordId = `${emp.emp_id}_${td}_${isOT ? "OT" : "REG"}_${Date.now()}`;
        await addAttendance({
          id: recordId,
          emp_id: emp.emp_id,
          date: td,
          check_in: ts,
          method: "face",
          is_ot: isOT,
          checkin_photo: snapshot,
          checkin_conf: conf,
        });

        setScanResult({
          ok: true,
          action: "Check-In",
          emp,
          conf,
          time: ts,
          photoSrc: snapshot,
          msg: `🟢 Welcome back, ${emp.name}! Check-IN registered successfully at ${ts} (${conf}% bio consistency).`,
        });
      } else {
        await updateAttendance(openRecord.id, {
          check_out: ts,
          checkout_photo: snapshot,
          checkout_conf: conf,
        });

        setScanResult({
          ok: true,
          action: "Check-Out",
          emp,
          conf,
          time: ts,
          photoSrc: snapshot,
          msg: `🔴 Safe travels, ${emp.name}! Check-OUT registered successfully at ${ts} (${conf}% bio consistency).`,
        });
      }
    } catch (e: any) {
      console.error(e);
      setScanResult({
        ok: false,
        msg: `❌ System operational fault: ${e.message}`,
      });
    }

    setProcessing(false);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#E0E0E0] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background aesthetic blobs matching Elegant Dark palette */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-505/5 bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-550/5 bg-purple-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Admin Unlock button */}
      <button
        className="absolute top-4 left-4 bg-[#121214] border border-white/5 hover:bg-[#1A1A1D] hover:border-white/10 text-gray-300 hover:text-white font-medium px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all outline-none z-50 backdrop-blur-md shadow-lg"
        onClick={() => setShowAdminModal(true)}
      >
        🛡️ Access Administration Control
      </button>

      {/* PWA Install App button */}
      {deferredPrompt && (
        <button
          className="absolute top-4 right-4 bg-indigo-650 border border-indigo-500/20 hover:bg-indigo-600 text-white font-semibold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all outline-none z-50 backdrop-blur-md shadow-lg animate-bounce duration-1000"
          onClick={handleInstallClick}
        >
          📥 Install WorkSync App
        </button>
      )}

      {!isKiosk ? (
        <div className="w-full max-w-md bg-[#121214] border border-white/5 rounded-2xl p-8 shadow-2xl text-center relative z-10">
          <div className="flex items-center justify-center gap-3.5 mb-4 scale-95 md:scale-100">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-bold text-white text-xl">W</span>
            </div>
            <span className="text-2xl font-semibold tracking-tight text-white">WorkSync</span>
          </div>
          <p className="text-gray-405 text-gray-400 text-sm mb-8 font-medium">Automatic Biometric Attendance Console</p>

          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              ⚡ Local Database Storage Live
            </span>
          </div>

          <button
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-md py-4 px-6 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-500/25 select-none"
            onClick={() => setIsKiosk(true)}
          >
            📷 Entering Attendance Terminal
          </button>

          <div className="mt-8 text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            Authorized worker scanning terminal only. Face-api verification runs entirely in sandboxed local IndexedDB storage.
          </div>
        </div>
      ) : (
        /* TERMINAL SCREEN */
        <div className="w-full max-w-lg bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-2xl relative z-10">
          <div className="flex justify-between items-center mb-6">
            <span className="flex items-center gap-2 text-indigo-400 font-semibold tracking-wider text-xs uppercase select-none">
              ⬡ worksync attendant
            </span>
            <button
              className="bg-[#1A1A1D] border border-white/10 hover:bg-[#222226] text-gray-300 text-xs px-3.5 py-1.5 rounded-xl transition-all font-semibold"
              onClick={() => {
                setIsKiosk(false);
                setScanResult(null);
                stopCamera();
              }}
            >
              ← Terminate
            </button>
          </div>

          {/* Results Alert Pane */}
          {scanResult ? (
            <div className="text-center py-6 flex flex-col items-center">
              <span className="text-6xl mb-4 select-none">
                {scanResult.ok ? "🟢" : "⚠️"}
              </span>
              <h2 className={`text-2xl font-black mb-2 ${scanResult.ok ? "text-emerald-400" : "text-rose-450"}`}>
                {scanResult.action ? `${scanResult.action} Confirmed` : "Biometrics Rejected"}
              </h2>
              <p className="text-gray-300 text-sm mb-6 max-w-sm px-2 font-medium">
                {scanResult.msg}
              </p>

              {scanResult.ok && scanResult.emp && (
                <div className="w-full bg-[#0A0A0C]/80 border border-white/5 rounded-2xl p-4 flex gap-4 items-center text-left max-w-sm mb-6 shadow-xl">
                  {scanResult.emp.photo ? (
                    <img
                      src={scanResult.emp.photo}
                      className="w-16 h-16 rounded-full object-cover border border-indigo-500 shadow"
                      alt="enrolled credentials"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#1C1C1F] border border-indigo-505 flex items-center justify-center text-2xl select-none">
                      👤
                    </div>
                  )}
                  <div>
                    <h4 className="text-white font-extrabold text-sm">{scanResult.emp.name}</h4>
                    <p className="text-indigo-400 text-xs font-mono mt-0.5">ID: {scanResult.emp.emp_id}</p>
                    <p className="text-gray-400 text-[11px] mt-1 font-semibold uppercase tracking-wider">{scanResult.emp.role || "Staff Employee"}</p>
                  </div>
                </div>
              )}

              {scanResult.photoSrc && (
                <div className="mb-4">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-2">Live Matching Proof Capture</p>
                  <img
                    src={scanResult.photoSrc}
                    className={`w-40 aspect-[4/3] object-cover rounded-xl border-2 ${
                      scanResult.action === "Check-In" ? "border-emerald-500" : "border-rose-500"
                    }`}
                    alt="match frame proof"
                  />
                </div>
              )}

              <div className="w-full max-w-xs mt-6">
                <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(counter / 8) * 100}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-3 font-medium select-none">
                  ⏱️ Returning to scanning loop in <strong>{counter}s</strong>
                </p>
              </div>
            </div>
          ) : (
            /* Live scanning page */
            <div>
              {/* Daily Shift Type Selector */}
              <div className="flex gap-2.5 mb-5">
                <button
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all outline-none ${
                    shiftType === "regular" ? "bg-indigo-600 text-white shadow shadow-indigo-500/20" : "bg-[#1A1A1D] hover:bg-[#222226] text-gray-400 border border-white/5"
                  }`}
                  onClick={() => setShiftType("regular")}
                >
                  💼 Standard Shift
                </button>
                <button
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all outline-none ${
                    shiftType === "ot" ? "bg-purple-600 text-white shadow shadow-purple-500/20" : "bg-[#1A1A1D] hover:bg-[#222226] text-gray-400 border border-white/5"
                  }`}
                  onClick={() => setShiftType("ot")}
                >
                  ⏱ Overtime Hours
                </button>
              </div>

              {!fallbackMode ? (
                <>
                  {/* Realtime Cam viewport container */}
                  <div className="relative mb-5 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                    <CamView camOn={camOn} captured={null} vRef={vRef} cvRef={cvRef} />

                    {processing && (
                      <div className="absolute inset-0 bg-[#0A0A0C]/90 flex flex-col items-center justify-center gap-3 z-10 backdrop-blur-sm animate-fade-in">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-indigo-400 text-xs font-bold tracking-wide uppercase">Reading biometrical maps...</p>
                      </div>
                    )}

                    {camOn && !processing && (
                      <div className="absolute top-4 left-4 bg-rose-600/90 text-white px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                        <span className="text-[10px] font-black tracking-wider uppercase">Live Face scanning</span>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={modelState !== "ready" || processing}
                    className={`w-full py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      modelState === "ready"
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01] active:scale-100 shadow-xl shadow-indigo-500/20 cursor-pointer"
                        : "bg-white/5 text-gray-550 cursor-not-allowed"
                    }`}
                    onClick={handleKioskBiometricScan}
                  >
                    {modelState === "loading"
                      ? "⏳ Tuning Facial Biometric Networks..."
                      : modelState === "failed"
                      ? "❌ Local Biometric Engine Offline"
                      : "📷 SUBMIT SCAN FACE ATTENDANCE"}
                  </button>

                  <div className="flex justify-between items-center mt-5 text-[11px] text-gray-400 font-medium">
                    <span>
                      Machine Status: {modelState === "ready" ? "🟢 Biometrics Ready" : "⏳ Tuning models..."}
                    </span>
                    <button
                      className="text-indigo-450 hover:text-indigo-350 hover:underline outline-none bg-transparent border-none cursor-pointer font-bold"
                      onClick={() => setFallbackMode(true)}
                    >
                      Can't Scan? Use PIN Dropdown Fallback
                    </button>
                  </div>
                </>
              ) : (
                /* Fallback List dropdown selections */
                <div className="p-5 bg-[#0A0A0C]/80 border border-white/5 rounded-2xl text-left shadow-2xl animate-fade-in">
                  <p className="text-indigo-400 font-bold text-sm mb-1">🔍 Verification Fallback Mode</p>
                  <p className="text-gray-400 text-xs leading-relaxed mb-4">
                    In case camera is inaccessible in iframe frame limits, look up your worker registration card index and verify via PIN.
                  </p>

                  <label className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-1.5 block">Select Name</label>
                  <select
                    className="w-full bg-[#121214] border border-white/10 rounded-xl p-3 text-sm text-gray-200 outline-none focus:border-indigo-500/80 mb-5 transition-colors"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                  >
                    <option value="">-- Click here to select --</option>
                    {employees.map((emp) => (
                      <option key={emp.emp_id} value={emp.emp_id}>
                        {emp.name} (ID: {emp.emp_id})
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={!selectedEmpId || processing}
                    className={`w-full py-3.5 rounded-xl text-xs font-bold tracking-wider border-none uppercase transition-all duration-200 ${
                      selectedEmpId
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-500/20"
                        : "bg-white/5 text-gray-600 cursor-not-allowed"
                    }`}
                    onClick={handleManualKioskVerify}
                  >
                    {processing ? "⏳ Lodging record..." : "⚡ Press to Submit PIN Code"}
                  </button>

                  {!camError && (
                    <button
                      className="w-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-[#1A1A1D] text-gray-400 text-xs py-2.5 rounded-xl mt-3 transition-all font-semibold cursor-pointer"
                      onClick={() => {
                        setFallbackMode(false);
                        startCamera();
                      }}
                    >
                      📷 Toggle Camera Verification Scanner
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Admin login overlay popup */}
          {showAdminModal && (
            <div className="fixed inset-0 bg-[#0A0A0C]/90 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-md">
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                  🛡️ Admin Unlock Gate
                </h3>
                <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                  Administrator password verification is required to review records, calculations, or manage staff biometric indices.
                </p>

                <label className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-1 block">Admin Username</label>
                <input
                  type="text"
                  className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3 outline-none focus:border-indigo-500/50"
                  placeholder="e.g. Admin01"
                  value={aId}
                  onChange={(e) => {
                    setAId(e.target.value);
                    setAdminErr("");
                  }}
                />

                <label className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-1 block">Security Password</label>
                <input
                  type="password"
                  className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white mb-2 outline-none focus:border-indigo-500/50"
                  placeholder="••••••••"
                  value={aPw}
                  onChange={(e) => {
                    setAPw(e.target.value);
                    setAdminErr("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && doAdminLogin()}
                />

                {adminErr && <p className="text-rose-500 text-[11px] font-medium mb-3">{adminErr}</p>}

                <div className="flex gap-2.5 mt-5">
                  <button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01] font-bold text-xs py-2.5 rounded-xl border-none transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
                    onClick={doAdminLogin}
                  >
                    Unlock dashboard
                  </button>
                  <button
                    className="flex-1 bg-transparent hover:bg-[#1C1C1F] text-gray-400 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                       setShowAdminModal(false);
                       setAId("");
                       setAPw("");
                       setAdminErr("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
