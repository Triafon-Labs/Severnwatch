"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { APP_NAME, DISCLAIMER, DISCLAIMER_VERSION } from "@/lib/config";
import { DISCLAIMER_PENDING_ATTR, STORAGE_KEYS } from "@/lib/storageKeys";

const listeners = new Set<() => void>();
// Held in memory too, so accepting still closes the dialog when storage is
// unavailable (private mode, blocked site data) - it just comes back next visit.
let acceptedThisSession = false;

const isAccepted = () => {
  if (acceptedThisSession) return true;
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED) ===
      DISCLAIMER_VERSION
    );
  } catch {
    return false;
  }
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  // Accepting in one tab closes the dialog in the others.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

// The server can't see localStorage, so it renders as accepted (no dialog);
// the layout's inline script covers first-time visitors until hydration.
const getServerSnapshot = () => true;

// The first-run disclaimer. Nothing can be used until it's accepted: no
// backdrop click or Escape closes it. Accepting stores DISCLAIMER_VERSION, so
// it's shown once per device; bumping that asks everyone again.
export default function DisclaimerDialog() {
  const accepted = useSyncExternalStore(
    subscribe,
    isAccepted,
    getServerSnapshot
  );

  const accept = useCallback(() => {
    acceptedThisSession = true;
    try {
      localStorage.setItem(
        STORAGE_KEYS.DISCLAIMER_ACCEPTED,
        DISCLAIMER_VERSION
      );
    } catch {
      // Storage unavailable - acceptedThisSession covers this visit.
    }
    document.documentElement.removeAttribute(DISCLAIMER_PENDING_ATTR);
    listeners.forEach((l) => l());
  }, []);

  return (
    <Dialog
      open={!accepted}
      // Escape and backdrop clicks are ignored: only the button dismisses it.
      onClose={() => {}}
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-text"
      slotProps={{
        backdrop: {
          sx: {
            // Dark and blurred enough that the risk level can't be read
            // behind it.
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
          },
        },
        // M3's dialog corners, rather than the theme's default 12px shape.
        paper: { sx: { borderRadius: "28px" } },
      }}
    >
      {/* M3 dialogs title in Headline Small - h5 here, the card titles'
          style - rather than DialogTitle's default Title Large (h6). */}
      <DialogTitle id="disclaimer-title" variant="h5">
        Before you use {APP_NAME}
      </DialogTitle>
      <DialogContent>
        {/* The main text colour, as the cards use for their body text, rather
            than DialogContentText's secondary grey: this is the message
            everyone has to read, not supporting detail. */}
        <DialogContentText id="disclaimer-text" color="text.primary">
          {DISCLAIMER}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={accept}>
          I understand
        </Button>
      </DialogActions>
    </Dialog>
  );
}
