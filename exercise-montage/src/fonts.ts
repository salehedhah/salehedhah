import { loadFont as loadCairo } from "@remotion/google-fonts/Cairo";

export const { fontFamily: captionFontFamily } = loadCairo("normal", {
  weights: ["900"],
  subsets: ["arabic"],
});
