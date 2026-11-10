"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  Tab,
  Tabs,
  ToggleButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import NextLink from "next/link";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";
import { WaterQualityDeepDive } from "@/components/WaterQualityInfoContent";
import ConditionsKey from "@/components/ConditionsKey";
import { useAppTheme, ThemeMode } from "@/lib/ThemeContext";
import { APP_NAME, USEFUL_LINKS } from "@/lib/config";
import { m3Duration, m3Easing, m3Spring, spring } from "@/lib/m3-palette";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

// How far down the sheet has to be dragged to dismiss on release, as a share
// of its own height, and the flick speed that dismisses regardless of
// distance. A short, fast swipe reads as "get rid of this" even when it
// covered barely any ground, which is why velocity gets its own threshold.
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;

// An inline link in the About text, opened in a new tab - Paddlecheck's.
const SourceLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit">
    {children}
  </Link>
);

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState<"settings" | "info">("settings");
  // Both tab panels stay mounted (see the grid below), so the deep-dive
  // accordion's expanded state would otherwise persist in the background -
  // leaving Settings sized to match an accordion the user can't even see.
  // Resetting it on every tab change keeps each visit to Info predictable
  // and avoids that phantom height.
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [conditionsKeyOpen, setConditionsKeyOpen] = useState(false);
  const { themeMode, setThemeMode } = useAppTheme();

  // --- Drag to dismiss ---
  //
  // The sheet has a drag handle, and a handle that doesn't drag is a label for
  // a gesture that isn't there. The transform is written straight to the node
  // rather than held in state: this runs on every pointermove, and a React
  // render per frame is how a drag ends up trailing the finger.
  //
  // Only the header drags. The panels below it scroll, and a sheet that
  // dismisses when you try to scroll its contents is worse than one that
  // doesn't drag at all.
  const paperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startY: number;
    startedAt: number;
    dy: number;
  } | null>(null);

  const setSheetOffset = useCallback((y: number, animate: boolean) => {
    const paper = paperRef.current;
    if (!paper) return;
    paper.style.transition = animate
      ? spring("transform", m3Spring.spatialDefault)
      : "none";
    paper.style.transform = y > 0 ? `translateY(${y}px)` : "";
  }, []);

  // Clear any leftover offset when the sheet reopens, so a sheet flung shut
  // doesn't come back part-way down the screen. MUI's Slide writes its own
  // transform during the open and close transitions and overwrites whatever
  // is here, which is what makes a dismissing drag hand off to the exit
  // animation from wherever the finger left it.
  useEffect(() => {
    if (open) setSheetOffset(0, false);
  }, [open, setSheetOffset]);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      startY: e.clientY,
      startedAt: performance.now(),
      dy: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Downward only. Dragging up would lift the sheet off the bottom of the
    // screen and expose the page behind it.
    drag.dy = Math.max(0, e.clientY - drag.startY);
    setSheetOffset(drag.dy, false);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const height = paperRef.current?.offsetHeight ?? 0;
    const velocity = drag.dy / Math.max(1, performance.now() - drag.startedAt);
    if (
      drag.dy > height * DISMISS_DISTANCE_RATIO ||
      velocity > DISMISS_VELOCITY_PX_PER_MS
    ) {
      onClose();
    } else {
      setSheetOffset(0, true);
    }
  };

  // Both panels stay mounted and share one grid cell, so switching tabs
  // crossfades rather than swapping. The inactive one is collapsed to zero
  // height, though, which is what makes the sheet size to whichever panel is
  // showing: Settings here is a single control and Info runs to several
  // screens, so letting the row take the taller of the two - the way a more
  // evenly matched pair of panels could - would leave Settings as one toggle
  // floating above 700px of nothing.
  const panelSx = (isActive: boolean) => ({
    gridArea: "1 / 1",
    px: 2,
    pb: isActive ? 3 : 0,
    height: isActive ? "auto" : 0,
    overflow: isActive ? "visible" : "hidden",
    opacity: isActive ? 1 : 0,
    pointerEvents: isActive ? ("auto" as const) : ("none" as const),
    // "inherit" rather than "visible": the sheet is kept mounted while
    // closed (see `prebuilt` below), and an explicit "visible" would override
    // the closed drawer's own hidden - leaving this panel's controls in the
    // tab order, and painted wherever the off-screen sheet comes into view.
    visibility: isActive ? ("inherit" as const) : ("hidden" as const),
    transition: isActive
      ? `opacity ${m3Duration.short4}ms ${m3Easing.standard}`
      : `opacity ${m3Duration.short4}ms ${m3Easing.standard}, visibility 0s linear ${m3Duration.short4}ms`,
  });

  // Built ahead of time once the page is idle, then kept, so opening is only
  // the slide. Built on the tap, the whole sheet - and every style Emotion
  // has to insert for it - holds the first frame for a few hundred
  // milliseconds on a phone-speed CPU.
  const [prebuilt, setPrebuilt] = useState(false);
  useEffect(() => {
    const build = () => setPrebuilt(true);
    // Safari has no requestIdleCallback; a few seconds after load stands in.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(build, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(build, 3000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: prebuilt }}
      slotProps={{
        paper: {
          ref: paperRef,
          sx: {
            borderRadius: "16px 16px 0 0",
            // dvh, not vh: in a browser tab vh is the viewport with the URL
            // bar retracted, so 90vh can be taller than what's on screen.
            maxHeight: "90dvh",
            backgroundImage: "none",
            display: "flex",
            flexDirection: "column",
            // The drawer is portalled to <body>, so it sits outside the
            // safe-area frame in app/layout.tsx and has to inset itself. It
            // is anchored to the bottom of the screen, which on an installed
            // iOS app is behind the home indicator.
            pb: "env(safe-area-inset-bottom)",
          },
        },
      }}
    >
      <Box
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        sx={{
          flexShrink: 0,
          // Without this the browser claims vertical drags for scrolling
          // before the pointermove handler ever sees them.
          touchAction: "none",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
        }}
      >
        {/* M3's 32x4dp drag handle. Decorative rather than a control: the
            close button beside it and Escape both already dismiss the sheet,
            so announcing a third way to a screen reader adds noise, not a
            route. */}
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 4,
            mx: "auto",
            mt: 1.5,
            mb: 0.5,
            borderRadius: 9999,
            backgroundColor: "surfaces.onVariant",
            opacity: 0.4,
          }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="h5">Settings</Typography>
          <IconButton
            onClick={onClose}
            edge="end"
            aria-label="close"
            // The button sits inside the drag region, so its own presses have
            // to stay out of the drag: without this, pressing close starts a
            // zero-distance drag that captures the pointer and swallows the
            // click.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, val: "settings" | "info") => {
          setActiveTab(val);
          setDeepDiveOpen(false);
          setConditionsKeyOpen(false);
        }}
        variant="fullWidth"
        sx={{ px: 2, flexShrink: 0, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="settings" label="Settings" />
        <Tab value="info" label="Info" />
      </Tabs>

      <Box sx={{ display: "grid", overflowY: "auto" }}>
        <Box
          aria-hidden={activeTab !== "settings"}
          sx={panelSx(activeTab === "settings")}
        >
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Theme
          </Typography>
          <SlidingToggleButtonGroup
            value={themeMode}
            exclusive
            onChange={(_, val: ThemeMode | null) => {
              if (val) setThemeMode(val);
            }}
            fullWidth
            size="small"
          >
            <ToggleButton value="light">Light</ToggleButton>
            <ToggleButton value="system">System</ToggleButton>
            <ToggleButton value="dark">Dark</ToggleButton>
          </SlidingToggleButtonGroup>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            System follows your device&apos;s light/dark setting.
          </Typography>
        </Box>

        <Box
          aria-hidden={activeTab !== "info"}
          sx={panelSx(activeTab === "info")}
        >
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            About {APP_NAME}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            River Severn conditions at Worcester - sewage spill status, upstream
            rainfall, and citizen science water quality, in one place.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Useful Links
          </Typography>
          <List disablePadding>
            {USEFUL_LINKS.map((link) => (
              <ListItem
                key={link.name}
                component={Link}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                // `primary` is the M3 role for a link, and the dark scheme's
                // primary is a light teal that clears contrast on the drawer
                // surface, so one colour serves both schemes.
                sx={{ pl: 0, color: "primary.main" }}
              >
                <Typography sx={{ flexGrow: 1 }}>{link.name}</Typography>
                <OpenInNewIcon fontSize="small" />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />

          <Accordion
            expanded={conditionsKeyOpen}
            onChange={(_, isExpanded) => setConditionsKeyOpen(isExpanded)}
            disableGutters
            elevation={0}
            sx={{ "&:before": { display: "none" }, mx: -2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <Typography variant="h6">Conditions Key</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0 }}>
              <ConditionsKey />
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Accordion
            expanded={deepDiveOpen}
            onChange={(_, isExpanded) => setDeepDiveOpen(isExpanded)}
            disableGutters
            elevation={0}
            sx={{ "&:before": { display: "none" }, mx: -2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <Typography variant="h6">
                How spills &amp; classifications work
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0 }}>
              <WaterQualityDeepDive />
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography>{APP_NAME} Version</Typography>
            <Typography>
              {process.env.NEXT_PUBLIC_APP_VERSION || "N/A"}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2, display: "block" }}
          >
            This is a hobby project, so there might be mistakes. Always check
            conditions yourself and use your own judgement before entering the
            water.
          </Typography>
          {/* Required by the sources' licences, as in Paddlecheck. The
              Environment Agency's Open Government Licence asks for this exact
              statement (it's the one the EA gives for the whole real-time
              API, rainfall included); Open-Meteo and Severn Trent's storm
              overflow feed are CC BY 4.0, which needs a credit; Nominatim's
              place names are OpenStreetMap data under the ODbL, which needs
              the "© OpenStreetMap contributors" line. SAS's samples carry no
              stated licence, so they get a plain credit. */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            This uses Environment Agency flood and river level data from the
            real-time data API (Beta), under the{" "}
            <SourceLink href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">
              Open Government Licence
            </SourceLink>
            . Storm overflow data © Severn Trent Water (
            <SourceLink href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </SourceLink>
            ). Rainfall forecast by{" "}
            <SourceLink href="https://open-meteo.com/">Open-Meteo</SourceLink> (
            <SourceLink href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </SourceLink>
            ). Outfall place names ©{" "}
            <SourceLink href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </SourceLink>
            , via Nominatim. Water quality samples from{" "}
            <SourceLink href="https://www.sas.org.uk/">
              Surfers Against Sewage
            </SourceLink>
            &apos;s citizen science programme.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* The way in to /upload for whoever does the weekly testing, so
              it doesn't rest on them keeping a bookmark. At the foot of the
              sheet so it doesn't draw a reader's eye; the passcode on the
              page is what guards uploads, not the link being hidden. */}
          <Typography variant="h6" gutterBottom>
            For Testers
          </Typography>
          <ListItem
            component={NextLink}
            href="/upload"
            onClick={onClose}
            sx={{ pl: 0, color: "primary.main" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography>Upload Sample Results</Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Add this week&apos;s SAS export. Needs the testers&apos;
                passcode.
              </Typography>
            </Box>
            <ChevronRightIcon fontSize="small" />
          </ListItem>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SettingsModal;
