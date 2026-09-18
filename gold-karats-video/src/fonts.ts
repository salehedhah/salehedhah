import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";
import { loadFont as loadArefRuqaaInk } from "@remotion/google-fonts/ArefRuqaaInk";

export const { fontFamily: lightFontFamily } = loadAmiri("normal", {
  weights: ["400"],
  subsets: ["arabic"],
});

export const { fontFamily: boldFontFamily } = loadArefRuqaaInk("normal", {
  weights: ["700"],
  subsets: ["arabic"],
});
