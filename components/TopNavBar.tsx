"use client";

import { useState } from "react";
import { AppBar, IconButton, Toolbar, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import SevernwatchLogo from "@/components/SevernwatchLogo";
import SettingsDialog from "@/components/SettingsDialog";

const TopNavBar: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <SevernwatchLogo color="primary" />
        <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
          Severnwatch
        </Typography>
        <IconButton
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
          color="inherit"
        >
          <SettingsIcon />
        </IconButton>
      </Toolbar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppBar>
  );
};

export default TopNavBar;
