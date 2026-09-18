import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type PetalProps = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  startRotation: number;
  spin: number;
};

export const Petal: React.FC<PetalProps> = ({
  top,
  bottom,
  left,
  right,
  size,
  startRotation,
  spin,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const rotation = interpolate(
    frame,
    [0, durationInFrames],
    [startRotation, startRotation + spin],
  );

  return (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        width: size,
        height: size * 0.42,
        borderRadius: size,
        backgroundColor: theme.petal,
        opacity: 0.55,
        filter: "blur(18px)",
        rotate: `${rotation}deg`,
      }}
    />
  );
};
