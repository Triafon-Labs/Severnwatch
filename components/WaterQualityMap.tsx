"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Card, CardContent, Divider, IconButton, Typography } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { SAS_MAP_EMBED_URL } from "@/lib/config";
import WaterQualityExplainer from "@/components/WaterQualityExplainer";

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        void containerRef.current.requestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
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
          Surfers Against Sewage&apos;s water quality map, showing citizen science
          bacteria sampling results across the whole UK. This isn&apos;t filtered
          to Worcester - pan and zoom to the River Severn to find results near
          here.
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
          }}
        >
          <IconButton
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Expand map to fullscreen"}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
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
          <Box
            component="iframe"
            src={SAS_MAP_EMBED_URL}
            title="SAS Water Quality Map"
            loading="lazy"
            allow="geolocation"
            sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
          />
        </Box>

        <Divider sx={{ mt: 2 }} />
        <WaterQualityExplainer />
      </CardContent>
    </Card>
  );
};

export default WaterQualityMap;
