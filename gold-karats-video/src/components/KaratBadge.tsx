import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { boldFontFamily, lightFontFamily } from "../fonts";

type KaratBadgeProps = {
  karat: string;
  durationInFrames: number;
};

export const KaratBadge: React.FC<KaratBadgeProps> = ({
  karat,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 200 }),
    output: "perceptual-scale",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        right: 56,
        width: 148,
        height: 148,
        borderRadius: "50%",
        border: `3px dashed ${theme.gold}`,
        backgroundColor: "rgba(245, 239, 228, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        scale: pop,
        opacity: pop * fadeOut,
        boxShadow: "0 18px 30px rgba(42, 33, 25, 0.25)",
      }}
    >
      <div
        style={{
          fontFamily: lightFontFamily,
          fontSize: 22,
          color: theme.ink,
          fontWeight: 500,
        }}
      >
        عيار
      </div>
      <div
        style={{
          fontFamily: boldFontFamily,
          fontSize: 56,
          color: theme.gold,
          lineHeight: 1,
        }}
      >
        {karat}
      </div>
    </div>
  );
};
