import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { boldFontFamily, lightFontFamily } from "../fonts";

type CaptionProps = {
  light: string;
  bold: string;
  durationInFrames: number;
};

export const Caption: React.FC<CaptionProps> = ({
  light,
  bold,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = 12;
  const fadeOut = 12;

  const opacity = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.16, 1, 0.3, 1)],
    },
  );

  const rise = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [16, 0, 0, -16],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.16, 1, 0.3, 1)],
    },
  );

  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        top: 120,
        left: 40,
        right: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity,
        translate: `0px ${rise}px`,
      }}
    >
      <div
        style={{
          fontFamily: lightFontFamily,
          fontWeight: 300,
          fontSize: 40,
          color: theme.ink,
        }}
      >
        {light}
      </div>
      <div
        style={{
          fontFamily: boldFontFamily,
          fontWeight: 700,
          fontSize: 78,
          color: theme.gold,
          lineHeight: 1.15,
        }}
      >
        {bold}
      </div>
    </div>
  );
};
