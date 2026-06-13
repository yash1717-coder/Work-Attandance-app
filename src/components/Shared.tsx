/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface StatusBarProps {
  online: boolean;
  loading: boolean;
  dbErr: string;
}

export function StatusBar({ online, loading, dbErr }: StatusBarProps) {
  const col = online ? "bg-[#121214] border-emerald-500/20 text-emerald-400" : dbErr ? "bg-[#121214] border-rose-500/20 text-rose-450" : "bg-[#121214] border-white/5 text-gray-400";
  const txt = loading
    ? "⏳ Connecting to local IndexedDB storage..."
    : online
    ? "IndexedDB Active"
    : dbErr
    ? "Local Storage Alert: " + dbErr
    : "Offline Operational Mode";

  return (
    <div className={`px-5 py-2.5 text-xs border border-white/5 bg-[#121214] rounded-2xl flex items-center justify-between transition-colors shadow-xl`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : dbErr ? 'bg-rose-500 animate-pulse' : 'bg-gray-650'} `} />
        <span className="font-sans font-medium tracking-wide text-gray-350">{txt}</span>
      </div>
      <span className="hidden sm:inline-block font-mono text-[10px] text-gray-500 uppercase tracking-widest">VER: 3.1.0 (indexedDB-offline)</span>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string | number;
  colorClass: string; // e.g. "border-emerald-500 text-emerald-400"
  icon: string;
}

export function Stat({ label, value, colorClass, icon }: StatProps) {
  let accentBarBg = "bg-indigo-500";
  if (colorClass.includes("emerald")) accentBarBg = "bg-emerald-500";
  if (colorClass.includes("rose")) accentBarBg = "bg-rose-500";
  if (colorClass.includes("amber")) accentBarBg = "bg-amber-500";
  if (colorClass.includes("sky")) accentBarBg = "bg-indigo-400";
  if (colorClass.includes("purple")) accentBarBg = "bg-purple-500";

  return (
    <div className="bg-[#121214] border border-white/5 p-6 rounded-2xl shadow-xl relative overflow-hidden transition-all duration-300 hover:border-white/10 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-550 text-xs uppercase tracking-wider font-semibold mb-1">{label}</p>
          <div className="text-3xl font-bold tracking-tight text-white mt-1 group-hover:text-indigo-305 transition-colors">{value}</div>
        </div>
        <span className="text-2xl filter drop-shadow opacity-80 group-hover:scale-110 transition-transform duration-300">{icon}</span>
      </div>
      <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${accentBarBg} w-3/4 opacity-85 transition-all duration-500`} />
      </div>
    </div>
  );
}

interface BadgeProps {
  label: string;
  type: "success" | "danger" | "info" | "warning" | "default";
}

export function Badge({ label, type }: BadgeProps) {
  const classes = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-indigo-500/10 text-indigo-450 border-indigo-500/20",
    warning: "bg-amber-500/10 text-amber-450 border-amber-500/20",
    default: "bg-white/5 text-gray-400 border-white/10",
  }[type];

  return (
    <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-lg tracking-wider uppercase ${classes} whitespace-nowrap`}>
      {label}
    </span>
  );
}

interface MsgBoxProps {
  msg: string;
  type: "success" | "error" | "info" | "warn";
}

export function MsgBox({ msg, type }: MsgBoxProps) {
  if (!msg) return null;
  const classes = {
    success: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
    error: "bg-rose-500/5 border-rose-500/20 text-rose-450",
    info: "bg-indigo-500/5 border-indigo-500/20 text-indigo-400",
    warn: "bg-amber-500/5 border-amber-500/20 text-amber-400",
  }[type];

  return (
    <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed ${classes} transition-all`}>
      {msg}
    </div>
  );
}

interface CamViewProps {
  camOn: boolean;
  captured: string | null;
  vRef: React.RefObject<HTMLVideoElement | null>;
  cvRef: React.RefObject<HTMLCanvasElement | null>;
  imgRef?: React.RefObject<HTMLImageElement | null>;
}

export function CamView({ camOn, captured, vRef, cvRef, imgRef }: CamViewProps) {
  return (
    <div className="w-full bg-[#0A0A0C] rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center relative border border-white/5 shadow-2xl">
      <video
        ref={vRef as any}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        style={{ display: camOn && !captured ? "block" : "none" }}
      />
      <canvas ref={cvRef as any} className="hidden" />
      {captured && !camOn && (
        <img
          ref={imgRef as any}
          src={captured}
          className="absolute inset-0 w-full h-full object-cover"
          crossOrigin="anonymous"
          alt="captured biometrics"
        />
      )}
      {!camOn && !captured && (
        <div className="text-center text-gray-500 z-10 flex flex-col items-center select-none p-6">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/5">
            <span className="text-xl">📷</span>
          </div>
          <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Camera Terminal Dormant</span>
          <p className="text-[10px] text-gray-600 mt-1 max-w-xs">Face-match verification system is primed and ready to boot</p>
        </div>
      )}
    </div>
  );
}

interface LightboxProps {
  src: string | null;
  label: string | null;
  onClose: () => void;
}

export function Lightbox({ src, label, onClose }: LightboxProps) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 bg-[#0A0A0C]/95 flex flex-col items-center justify-center p-4 z-[999] backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="relative max-w-full max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          className="max-w-[90vw] max-h-[75vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
          alt="biometrics proof closeup"
        />
        <button
          className="absolute -top-12 right-0 bg-[#121214] hover:bg-[#1A1A1D] text-gray-300 hover:text-white px-4 py-2 text-xs rounded-xl border border-white/5 font-bold transition-all shadow-lg"
          onClick={onClose}
        >
          ✕ Close view
        </button>
        {label && (
          <p className="mt-4 text-xs tracking-wider text-center bg-[#121214] border border-white/5 px-4 py-2.5 rounded-xl text-gray-300 max-w-lg shadow-xl">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
