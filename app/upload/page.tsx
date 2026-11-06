import type { Metadata } from "next";
import { Container } from "@mui/material";
import UploadForm from "@/components/UploadForm";
import { APP_NAME } from "@/lib/config";

// Where the tester uploads each week's SAS export. Not linked from the app:
// it's bookmarked by whoever does the testing, and kept out of search results.
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
