/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee } from "./db";

let _faceLoaded = false;
let _faceLoading = false;
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

// Asynchronously pre-loads and initializes SSD Mobilenet and Face Recognition models
export async function loadFaceApi(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (_faceLoaded) return true;

  if (_faceLoading) {
    return new Promise((res) => {
      const idx = setInterval(() => {
        if (_faceLoaded) {
          clearInterval(idx);
          res(true);
        }
      }, 300);
    });
  }

  _faceLoading = true;
  return new Promise((resolve) => {
    const faceapi = (window as any).faceapi;
    if (faceapi) {
      initFaceApiModels(resolve);
      return;
    }

    // Dynamic fallback script injector just in case
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
    script.onload = () => initFaceApiModels(resolve);
    script.onerror = () => {
      _faceLoading = false;
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

// Face landmark nets init
async function initFaceApiModels(resolve: (v: boolean) => void) {
  try {
    const faceapi = (window as any).faceapi;
    if (!faceapi) {
      resolve(false);
      return;
    }
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    _faceLoaded = true;
    resolve(true);
  } catch (err) {
    console.error("Error loading face-api neural models:", err);
    resolve(false);
  }
}

// Scans an image / video / canvas element and yields a 128-float face feature coordinates array
export async function getFaceDescriptor(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<number[] | null> {
  const faceapi = (window as any).faceapi;
  if (!faceapi) return null;
  try {
    const det = await faceapi
      .detectSingleFace(el, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return det ? Array.from(det.descriptor) : null;
  } catch (err) {
    console.error("detect descriptor fail", err);
    return null;
  }
}

// Matches a calculated descriptor against enrolled profiles using strict euclidean metrics
export async function matchFace(
  desc: number[],
  emps: Employee[]
): Promise<{ emp: Employee; dist: number } | null> {
  const faceapi = (window as any).faceapi;
  if (!faceapi || !desc || !emps.length) return null;

  const cap = new Float32Array(desc);
  let best: { emp: Employee; dist: number } | null = null;
  let bestD = 0.55; // Standard distance matching threshold

  for (const e of emps) {
    if (!e.face_descriptor) continue;
    const arrayDesc = Array.isArray(e.face_descriptor)
      ? e.face_descriptor
      : Object.values(e.face_descriptor);

    if (!arrayDesc || arrayDesc.length === 0) continue;

    const d = faceapi.euclideanDistance(cap, new Float32Array(arrayDesc));
    if (d < bestD) {
      bestD = d;
      best = { emp: e, dist: d };
    }
  }
  return best;
}
