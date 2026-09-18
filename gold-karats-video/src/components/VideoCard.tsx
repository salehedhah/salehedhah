import React from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { theme } from "../theme";

export const VideoCard: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const scale = interpolate(enter, [0, 1], [0.92, 1], {
    output: "perceptual-scale",
  });

  const borderAngle = (frame * 2.4) % 360;

  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 40,
        right: 40,
        bottom: 90,
        borderRadius: 30,
        padding: 8,
        backgroundImage: `conic-gradient(from ${borderAngle}deg, ${theme.goldDeep}, ${theme.goldSoft}, ${theme.gold}, #FFF3CC, ${theme.goldDeep})`,
        opacity: enter,
        scale,
        translate: `0px ${(1 - enter) * 34}px`,
        boxShadow: `0 46px 80px rgba(0, 0, 0, 0.55), 0 0 60px ${theme.glow}`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 24,
          overflow: "hidden",
          border: `1px solid ${theme.cardBorderInner}`,
          backgroundColor: theme.backgroundCard,
        }}
      >
        <Video
          src={staticFile("gold-source.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
};
