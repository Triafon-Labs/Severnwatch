import type { Metadata } from "next";
import { Container } from "@mui/material";
import UploadForm from "@/components/UploadForm";
import { APP_NAME } from "@/lib/config";

// Where the tester uploads each week's SAS export, reached from Settings ->
// Info -> For Testers. Kept out of search results; the passcode on the page
// guards uploads.
export const metadata: Metadata = {
  title: `Upload Samples – ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function UploadPage() {
  return (
    <Container maxWidth="sm" sx={{ px: 2 }}>
      <UploadForm />
    </Container>
  );
}
