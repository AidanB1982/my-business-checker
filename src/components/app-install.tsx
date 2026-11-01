"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{outcome: "accepted" | "dismissed"}> };
export function AppInstall() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"}).catch(() => { /* The connected app still works when offline support is unavailable. */ });
    }
    const prompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const complete = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", complete);
    return () => { window.removeEventListener("beforeinstallprompt", prompt); window.removeEventListener("appinstalled", complete); };
  }, []);
  if (installed) return <p role="status" className="fine">App installed. You can open it from your home screen.</p>;
  return <div className="app-install">{installEvent ? <button className="button secondary" onClick={async () => { try { await installEvent.prompt(); await installEvent.userChoice; } finally { setInstallEvent(null); } }}>Install app</button> : <details><summary>Add to your phone</summary><p>On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen option when available.</p><p>Installation needs the hosted app over HTTPS. An internet connection is needed to open pages and sign in; calculations on an already open page work locally.</p></details>}</div>;
}
