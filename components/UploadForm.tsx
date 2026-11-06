"use client";

import { useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import NextLink from "next/link";
import { UploadResponse } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { WATER_QUALITY_SITE_NAME } from "@/lib/config";
import { formatLondonDate } from "@/lib/time";
import { collapseMotion } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The result line after a good upload: what was in the file and what it
// changed, so the tester can tell a fresh week from a re-upload.
const successSummary = (r: Extract<UploadResponse, { ok: true }>) => {
  const changes =
    r.added === 0 && r.updated === 0
      ? "nothing new, so nothing was changed. The site already has all of them"
      : [
          r.added > 0 && `${r.added} new`,
          r.updated > 0 && `${r.updated} updated`,
        ]
          .filter(Boolean)
          .join(", ");
  const latest = r.latestSampledAt
    ? ` Latest sample: ${formatLondonDate(Date.parse(r.latestSampledAt), { withTime: true })}.`
    : "";
  return `${plural(r.samples, "sample")} read - ${changes}.${latest}`;
};

const UploadForm: React.FC = () => {
  const [passcode, setPasscode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The data provider sits in the root layout, so it survives the client-side
  // hop back to the dashboard and would keep showing what it fetched when
  // this page opened. Refetching after a good upload means the dashboard
  // shows the new sample straight away.
  const { refetch } = useSevernContext();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !passcode) return;
    setBusy(true);
    setResult(null);
    const body = new FormData();
    body.append("passcode", passcode);
    body.append("file", file);
    try {
      const res = await fetch("/api/water-quality/upload", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as UploadResponse;
      setResult(json);
      if (json.ok) {
        if (json.added + json.updated > 0) refetch();
        // Ready for the next one, and no chance of sending the same file twice
        // by tapping Upload again.
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch {
      setResult({
        ok: false,
        error: "Couldn't reach the site. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h1">
          Upload Samples
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2 }}
        >
          Download the {WATER_QUALITY_SITE_NAME} data from the Surfers Against
          Sewage water quality map, then choose the CSV here. It&apos;s checked
          before anything changes, and the site updates within a minute.
        </Typography>

        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {/* A fixed username alongside the passcode, so a phone's password
                manager offers to save it and fills it in next week. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value="severnwatch-upload"
              readOnly
              hidden
            />
            <TextField
              label="Passcode"
              type="password"
              name="passcode"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              fullWidth
            />

            <Box>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                fullWidth
              >
                {file ? "Choose a Different File" : "Choose CSV File"}
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                />
              </Button>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, minHeight: "1.43em", wordBreak: "break-all" }}
              >
                {file ? file.name : "No file chosen"}
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={!file || !passcode || busy}
              startIcon={
                busy ? <CircularProgress size={18} color="inherit" /> : null
              }
            >
              {busy ? "Checking…" : "Upload"}
            </Button>

            <Collapse in={result !== null} unmountOnExit {...collapseMotion}>
              {result && (
                <InfoPanel
                  align="flex-start"
                  sx={{
                    backgroundColor: result.ok
                      ? "success.container"
                      : "error.container",
                    color: result.ok
                      ? "success.onContainer"
                      : "error.onContainer",
                  }}
                >
                  {result.ok ? (
                    <CheckCircleOutlineIcon sx={{ flexShrink: 0 }} />
                  ) : (
                    <ErrorOutlineIcon sx={{ flexShrink: 0 }} />
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {!result.ok
                        ? "Not uploaded"
                        : result.added + result.updated > 0
                          ? "Uploaded"
                          : "Already up to date"}
                    </Typography>
                    <Typography variant="body2">
                      {result.ok ? successSummary(result) : result.error}
                    </Typography>
                    {result.ok && (
                      <Link
                        component={NextLink}
                        href="/"
                        color="inherit"
                        variant="body2"
                        sx={{ display: "inline-block", mt: 0.5 }}
                      >
                        Back to the dashboard
                      </Link>
                    )}
                  </Box>
                </InfoPanel>
              )}
            </Collapse>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UploadForm;
