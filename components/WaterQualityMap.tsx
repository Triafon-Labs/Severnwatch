"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
} from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ScreenRotationOutlinedIcon from "@mui/icons-material/ScreenRotationOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { SAS_MAP_EMBED_URL } from "@/lib/config";
import WaterQualityExplainer from "@/components/WaterQualityExplainer";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

// Kept as its own component (rather than inlined into the page) so it can be
// swapped out later if a way to filter this down to just the Worcester area
// is found - for now it's the full UK-wide SAS map, embedded as-is.
//
// The classification explainer sits inside this card rather than floating
// beneath it: it only makes sense next to the map's colour-coded pins, and as
// a loose accordion under a card it read as a fifth top-level section of the
// page rather than as a footnote to this one.
const WaterQualityMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const isLandscape = useMediaQuery("(orientation: landscape)");

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        if (
          typeof window !== "undefined" &&
          window.screen?.orientation?.unlock
        ) {
          try {
            window.screen.orientation.unlock();
          } catch {
            // ignore if not permitted by browser
          }
        }
        if (!window.matchMedia("(orientation: landscape)").matches) {
          setShowToast(true);
        }
      } else {
        setShowToast(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Auto-hide toast after 4 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement && !isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        void containerRef.current.requestFullscreen();
      } else {
        setIsFullscreen(true);
        if (
          typeof window !== "undefined" &&
          window.screen?.orientation?.unlock
        ) {
          try {
            window.screen.orientation.unlock();
          } catch {
            // ignore
          }
        }
        if (!window.matchMedia("(orientation: landscape)").matches) {
          setShowToast(true);
        }
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          Citizen Science Water Quality
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Surfers Against Sewage&apos;s water quality map, showing citizen
          science bacteria sampling results across the UK. Zoom in to Worcester
          to view local results for the Severn.
        </Typography>
        <Box
          ref={containerRef}
          sx={{
            position: isFullscreen ? "fixed" : "relative",
            top: isFullscreen ? 0 : "auto",
            left: isFullscreen ? 0 : "auto",
            width: isFullscreen ? "100vw" : "100%",
            height: isFullscreen ? "100vh" : 600,
            zIndex: isFullscreen ? 1300 : "auto",
            borderRadius: isFullscreen ? 0 : 3,
            overflow: "hidden",
            border: isFullscreen ? "none" : "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: isFullscreen ? "flex" : "block",
            flexDirection:
              isFullscreen && isLandscape ? "row" : "column",
          }}
        >
          {/* Map wrapper area (takes remaining space in flex container) */}
          <Box
            sx={{
              position: "relative",
              flex: 1,
              width: "100%",
              height: isFullscreen
                ? isLandscape
                  ? "100%"
                  : "auto"
                : "100%",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {/* Fullscreen toggle button */}
            <IconButton
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen ? "Exit fullscreen" : "Expand map to fullscreen"
              }
              sx={{
                position: "absolute",
                top: isFullscreen
                  ? "calc(12px + env(safe-area-inset-top, 0px))"
                  : 12,
                right: isFullscreen
                  ? "calc(12px + env(safe-area-inset-right, 0px))"
                  : 12,
                zIndex: 25,
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: 2,
                "&:hover": {
                  bgcolor: "surfaces.containerHigh",
                },
              }}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>

            {/* Map iframe */}
            <Box
              component="iframe"
              src={SAS_MAP_EMBED_URL}
              title="SAS Water Quality Map"
              loading="lazy"
              allow="geolocation"
              sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />

            {/* Fullscreen Toast notification recommending landscape orientation */}
            {isFullscreen && showToast && !isLandscape && (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute",
                  top: "calc(16px + env(safe-area-inset-top, 0px))",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: "surfaces.containerHigh",
                  color: "text.primary",
                  boxShadow: 4,
                  maxWidth: "calc(100vw - 32px)",
                }}
              >
                <ScreenRotationOutlinedIcon fontSize="small" color="primary" />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, fontSize: "0.85rem" }}
                >
                  Rotate phone for landscape view
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowToast(false)}
                  aria-label="Dismiss notification"
                  sx={{ ml: 0.5, p: 0.5 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Paper>
            )}
          </Box>

          {/* Fullscreen minimisable legend panel (side-by-side in landscape, stacked at bottom in portrait) */}
          {isFullscreen &&
            (isLandscape ? (
              /* Landscape mode: side panel sitting alongside map embed */
              <Box
                sx={{
                  bgcolor: "background.paper",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  boxShadow: "-4px 0 16px rgba(0,0,0,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  width: isLegendExpanded ? 320 : 44,
                  maxWidth: isLegendExpanded ? "40vw" : 44,
                  pt: "env(safe-area-inset-top, 0px)",
                  pb: "env(safe-area-inset-bottom, 0px)",
                  pr: "env(safe-area-inset-right, 0px)",
                  transition:
                    "width 0.25s ease-in-out, max-width 0.25s ease-in-out",
                  overflow: "hidden",
                  flexShrink: 0,
                  height: "100%",
                }}
              >
                <Box
                  onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isLegendExpanded
                      ? "space-between"
                      : "center",
                    p: 1,
                    cursor: "pointer",
                    userSelect: "none",
                    bgcolor: "surfaces.containerHigh",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    minHeight: 44,
                  }}
                >
                  {isLegendExpanded && (
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        pl: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Water Quality Legend
                    </Typography>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLegendExpanded(!isLegendExpanded);
                    }}
                    aria-label={
                      isLegendExpanded ? "Minimize legend" : "Expand legend"
                    }
                  >
                    {isLegendExpanded ? (
                      <ChevronRightIcon />
                    ) : (
                      <ChevronLeftIcon />
                    )}
                  </IconButton>
                </Box>
                {isLegendExpanded ? (
                  <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
                    <ClassificationTablesSection />
                  </Box>
                ) : (
                  <Box
                    onClick={() => setIsLegendExpanded(true)}
                    sx={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      py: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        writingMode: "vertical-rl",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        fontWeight: 600,
                        color: "text.secondary",
                      }}
                    >
                      Legend
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              /* Portrait mode: stacked panel sitting below map embed */
              <Box
                sx={{
                  bgcolor: "background.paper",
                  borderTop: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
                  pb: "env(safe-area-inset-bottom, 0px)",
                  pl: "env(safe-area-inset-left, 0px)",
                  pr: "env(safe-area-inset-right, 0px)",
                  transition: "all 0.25s ease-in-out",
                  flexShrink: 0,
                  width: "100%",
                }}
              >
                <Box
                  onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1,
                    cursor: "pointer",
                    userSelect: "none",
                    bgcolor: "surfaces.containerHigh",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Water Quality Legend
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLegendExpanded(!isLegendExpanded);
                    }}
                    aria-label={
                      isLegendExpanded ? "Minimize legend" : "Expand legend"
                    }
                  >
                    {isLegendExpanded ? (
                      <ExpandMoreIcon />
                    ) : (
                      <ExpandLessIcon />
                    )}
                  </IconButton>
                </Box>
                <Collapse in={isLegendExpanded}>
                  <Box sx={{ p: 2, maxHeight: "45vh", overflowY: "auto" }}>
                    <ClassificationTablesSection />
                  </Box>
                </Collapse>
              </Box>
            ))}
        </Box>

        <Divider sx={{ mt: 2 }} />
        <WaterQualityExplainer />
      </CardContent>
    </Card>
  );
};

export default WaterQualityMap;
