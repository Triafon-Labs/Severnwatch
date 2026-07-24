import { AppBar, Toolbar, Typography } from "@mui/material";
import WavesIcon from "@mui/icons-material/Waves";

const TopNavBar: React.FC = () => (
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
      <WavesIcon color="primary" />
      <Typography variant="h6" component="span">
        Severnwatch
      </Typography>
    </Toolbar>
  </AppBar>
);

export default TopNavBar;
