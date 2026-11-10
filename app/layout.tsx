import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
import ThemeRegistry from "@/components/ThemeRegistry";
import TopNavBar from "@/components/TopNavBar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { SevernDataProvider } from "@/lib/SevernDataContext";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { Box } from "@mui/material";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

// Exposed as a CSS variable rather than a class, because the theme's type
// scale has to name the family (MUI writes font-family onto every Typography
// root, so it can't be inherited from <html>). next/font mangles the family
// name at build time - it is not "Roboto Flex" - so the theme has to reach it
// through this variable rather than by spelling the name out. See the
// fontFamily entry in lib/themes.ts.
const robotoFlex = localFont({
  src: "../node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-full-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-roboto-flex",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      // Preferred where supported: a real vector, sharp at any density.
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      {
        url: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // Paired with viewportFit: "cover" below - the translucent bar is what
    // hands the installed app the strip behind the status bar, which the
    // safe-area padding on the frame then insets the content back out of.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Matches the browser chrome to each scheme's page background (m3Light and
  // m3Dark's `surface`) rather than to the brand teal, so the chrome reads as
  // an extension of the page instead of a coloured band above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5FAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1418" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The init script below sets a colour-scheme class on <html> before React
    // hydrates, which would otherwise be reported as a hydration mismatch.
    <html lang="en" className={robotoFlex.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved colour scheme to <html> before the body is even
            parsed, so there's no window in which a flash of the wrong theme
            could paint. `attribute` and the storage key must match the
            ThemeProvider config in lib/ThemeContext.tsx. */}
        <InitColorSchemeScript
          attribute="class"
          defaultMode="system"
          modeStorageKey={STORAGE_KEYS.THEME_MODE}
        />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <ThemeRegistry>
          <SevernDataProvider>
            {/* viewportFit: "cover" above, plus the black-translucent status
                bar and display: standalone in the manifest, hand the installed
                iOS app the whole screen - including the strips behind the
                status bar, the home indicator and (in landscape) the rounded
                corners. Inset the frame by those strips so the nav bar and the
                cards don't sit underneath them. Every inset resolves to 0 off
                a notched device, so this is inert everywhere else. It sits on
                the frame rather than on the bar or the content because either
                one can be topmost: the offline/stale banners render above the
                AppBar. The exposed strips take this Box's background, which is
                both what the AppBar inherits and what themeColor declares, so
                they read as part of the page. */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                // dvh rather than vh: in a mobile browser tab vh measures the
                // viewport with the URL bar retracted, so 100vh leaves the
                // page permanently taller than what is actually on screen.
                minHeight: "100dvh",
                bgcolor: "background.default",
                pt: "env(safe-area-inset-top)",
                pb: "env(safe-area-inset-bottom)",
                pl: "env(safe-area-inset-left)",
                pr: "env(safe-area-inset-right)",
              }}
            >
              <TopNavBar />
              <Box
                component="main"
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  // Matches the gap between the cards below, so the first one
                  // sits the same distance from the app bar as the next does
                  // from it.
                  pt: 2,
                  pb: 2,
                }}
              >
                {children}
              </Box>
            </Box>
          </SevernDataProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
