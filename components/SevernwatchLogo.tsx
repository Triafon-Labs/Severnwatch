import SvgIcon, { SvgIconProps } from "@mui/material/SvgIcon";

// Mirrors the wave glyph used across the app icons (public/icons, favicon,
// manifest) so the in-app branding matches what's installed to the home screen.
const SevernwatchLogo: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M2 9c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 3.5 3 5 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 15c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 3.5 3 5 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
  </SvgIcon>
);

export default SevernwatchLogo;
