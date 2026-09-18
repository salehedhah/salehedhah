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
  const pop = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 200 }),
    output: "perceptual-scale",
  });

  const rotate = interpolate(frame, [4, 22], [-8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 244,
        right: 50,
        width: 156,
        height: 156,
        borderRadius: "50%",
        scale: pop,
        rotate: `${rotate}deg`,
        opacity: pop * fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: theme.goldGradient,
          padding: 2,
          boxShadow: `0 20px 40px rgba(0,0,0,0.55), 0 0 30px ${theme.glow}`,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundColor: theme.backgroundCard,
            border: `1px solid ${theme.cardBorderInner}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: theme.gold, fontSize: 16, marginBottom: 2 }}>
            ✦
          </div>
          <div
            style={{
              fontFamily: lightFontFamily,
              fontSize: 20,
              color: theme.ivory,
              opacity: 0.8,
            }}
          >
            عيار
          </div>
          <div
            style={{
              fontFamily: boldFontFamily,
              fontSize: 52,
              lineHeight: 1,
              backgroundImage: theme.goldGradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {karat}
          </div>
        </div>
      </div>
    </div>
  );
};
