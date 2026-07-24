import { createTheme } from "@mui/material/styles";

// Severnwatch uses MUI's built-in light/dark color schemes (system-preference
// driven) rather than Paddlecheck's custom M3 token palette + user-togglable
// ThemeContext - there's no settings/preferences surface here yet, so system
// preference alone is enough. Revisit if a manual toggle is added later.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#006C7F" }, // teal - water/river association
        background: { default: "#F5FAFB" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#4FD8E8" },
        background: { default: "#0B1418" },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto Flex", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 600 }, // card titles
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
});

export default theme;
