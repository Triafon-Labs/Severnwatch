"use client";

import { useState, SyntheticEvent } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SEVERN_TRENT_MAP_URL, SAS_MAP_EMBED_URL } from "@/lib/config";
import { WaterQualityDeepDive } from "@/components/WaterQualityInfoContent";
import packageJson from "@/package.json";

type ThemeMode = "light" | "system" | "dark";

interface Props {
  open: boolean;
  onClose: () => void;
}

const UsefulLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <Stack
    component={Link}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    sx={{
      py: 1,
      color: "text.primary",
      textDecoration: "none",
      "&:hover": { color: "primary.main" },
    }}
  >
    <Typography variant="body2">{label}</Typography>
    <OpenInNewIcon fontSize="small" sx={{ opacity: 0.6 }} />
  </Stack>
);

const SettingsTab: React.FC = () => {
  const { mode, setMode } = useColorScheme();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Theme
        </Typography>
        <ToggleButtonGroup
          value={mode ?? "system"}
          exclusive
          fullWidth
          size="small"
          onChange={(_: SyntheticEvent, value: ThemeMode | null) => {
            if (value) setMode(value);
          }}
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="system">System</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Stack>
  );
};

const InfoTab: React.FC = () => (
  <Stack spacing={3}>
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        About Severnwatch
      </Typography>
      <Typography variant="body2" color="text.secondary">
        River Severn conditions at Worcester - sewage spill status, rainfall,
        and citizen science water quality, in one place.
      </Typography>
    </Box>

    <Divider />

    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        Useful Links
      </Typography>
      <Stack divider={<Divider />}>
        <UsefulLink href={SEVERN_TRENT_MAP_URL} label="Severn Trent Storm Overflow Map" />
        <UsefulLink href={SAS_MAP_EMBED_URL} label="Surfers Against Sewage Water Quality Map" />
      </Stack>
    </Box>

    <Divider />

    <Accordion variant="outlined" sx={{ "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          How sewage spills &amp; water quality classifications work
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <WaterQualityDeepDive />
      </AccordionDetails>
    </Accordion>

    <Divider />

    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        About
      </Typography>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Severnwatch Version
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {packageJson.version}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        This is a hobby project, so there might be mistakes. Always check
        conditions yourself and use your own judgement before entering the
        water.
      </Typography>
    </Box>
  </Stack>
);

const SettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  const [tab, setTab] = useState<"settings" | "info">("settings");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
        Settings
        <IconButton onClick={onClose} aria-label="Close settings" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: "divider", mx: 3 }}
      >
        <Tab value="settings" label="Settings" />
        <Tab value="info" label="Info" />
      </Tabs>

      <DialogContent>{tab === "settings" ? <SettingsTab /> : <InfoTab />}</DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
