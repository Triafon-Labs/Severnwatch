import { Box, Card, CardContent, Divider, Typography } from "@mui/material";
import { SAS_MAP_EMBED_URL } from "@/lib/config";
import WaterQualityExplainer from "@/components/WaterQualityExplainer";

// Kept as its own component (rather than inlined into the page) so it can be
// swapped out later if a way to filter this down to just the Worcester area
// is found - for now it's the full UK-wide SAS map, embedded as-is.
//
// The classification explainer sits inside this card rather than floating
// beneath it: it only makes sense next to the map's colour-coded pins, and as
// a loose accordion under a card it read as a fifth top-level section of the
// page rather than as a footnote to this one.
const WaterQualityMap: React.FC = () => (
  <Card>
    <CardContent>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        Citizen Science Water Quality
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Surfers Against Sewage&apos;s water quality map, showing citizen science
        bacteria sampling results across the whole UK. This isn&apos;t filtered
        to Worcester - pan and zoom to the River Severn to find results near
        here.
      </Typography>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: 600,
          // Matches the 12px the theme gives its inner surfaces, one step
          // tighter than the card's own 16 so the frame reads as nested.
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          component="iframe"
          src={SAS_MAP_EMBED_URL}
          title="SAS Water Quality Map"
          loading="lazy"
          sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </Box>

      <Divider sx={{ mt: 2 }} />
      <WaterQualityExplainer />
    </CardContent>
  </Card>
);

export default WaterQualityMap;
