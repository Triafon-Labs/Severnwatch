import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import ThemeRegistry from "@/components/ThemeRegistry";
import TopNavBar from "@/components/TopNavBar";
import { Box } from "@mui/material";

const robotoFlex = localFont({
  src: "../node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-full-normal.woff2",
  weight: "100 900",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Severnwatch",
  description: "River Severn water quality and rainfall conditions at Worcester",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={robotoFlex.className}>
      <body style={{ fontFamily: "inherit" }}>
        <ThemeRegistry>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
              bgcolor: "background.default",
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
                pt: 4,
                pb: 4,
              }}
            >
              {children}
            </Box>
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  );
}
