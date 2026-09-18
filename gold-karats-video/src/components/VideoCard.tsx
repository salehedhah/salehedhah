import React from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";

export const VideoCard: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const scale = interpolate(enter, [0, 1], [0.9, 1], {
    output: "perceptual-scale",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 40,
        right: 40,
        bottom: 90,
        borderRadius: 36,
        overflow: "hidden",
        boxShadow: "0 40px 70px rgba(42, 33, 25, 0.35)",
        opacity: enter,
        scale,
        translate: `0px ${(1 - enter) * 30}px`,
      }}
    >
      <Video
        src={staticFile("gold-source.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};
