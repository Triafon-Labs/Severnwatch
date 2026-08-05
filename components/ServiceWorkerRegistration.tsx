"use client";
import { useEffect } from "react";

const ServiceWorkerRegistration: React.FC = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
};

export default ServiceWorkerRegistration;
