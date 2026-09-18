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
  const fadeIn = 18;
  const fadeOut = 16;

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
    [22, 0, 0, -14],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.16, 1, 0.3, 1)],
    },
  );

  const shimmer = interpolate(frame, [0, 42], [110, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.8, 0.4, 1),
  });

  const dividerWidth = interpolate(frame, [6, fadeIn + 6], [0, 64], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const blurAmt = interpolate(frame, [0, fadeIn], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const boldScale = interpolate(frame, [0, fadeIn], [0.78, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 10 }),
    output: "perceptual-scale",
  });

  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        top: 108,
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
          fontWeight: 400,
          fontSize: 34,
          letterSpacing: 1,
          color: theme.ivory,
          opacity: 0.85,
          filter: `blur(${blurAmt}px)`,
        }}
      >
        {light}
      </div>
      <div
        style={{
          width: dividerWidth,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${theme.gold}, transparent)`,
          margin: "10px 0",
        }}
      />
      <div
        style={{
          fontFamily: boldFontFamily,
          fontWeight: 700,
          fontSize: 76,
          lineHeight: 1.2,
          backgroundImage: theme.goldGradient,
          backgroundSize: "260% 100%",
          backgroundPositionX: `${shimmer}%`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          scale: boldScale,
          filter: `blur(${blurAmt}px) drop-shadow(0 6px 18px rgba(0,0,0,0.45))`,
        }}
      >
        {bold}
      </div>
    </div>
  );
};
