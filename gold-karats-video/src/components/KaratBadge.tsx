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
  const target = Number(karat);

  const pop = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 11 }),
    output: "perceptual-scale",
  });

  const rotateIn = interpolate(frame, [4, 22], [-8, 0], {
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

  const flare = interpolate(frame, [4, 34], [0.6, 2.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const flareOpacity = interpolate(frame, [4, 10, 34], [0, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const count = Math.round(
    interpolate(frame, [4, 26], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );

  const ringAngle = (frame * 4.5) % 360;
  const orbitAngle = ((frame * 5) % 360) * (Math.PI / 180);
  const orbitRadius = 86;

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
        rotate: `${rotateIn}deg`,
        opacity: pop * fadeOut,
      }}
    >
      {/* Flare burst on entrance */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          translate: "-50% -50%",
          width: 156,
          height: 156,
          borderRadius: "50%",
          scale: flare,
          opacity: flareOpacity,
          background: `radial-gradient(circle, ${theme.goldSoft} 0%, transparent 68%)`,
        }}
      />

      {/* Orbiting sparkle */}
      <div
        style={{
          position: "absolute",
          top: 78 + Math.sin(orbitAngle) * orbitRadius,
          left: 78 + Math.cos(orbitAngle) * orbitRadius,
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: theme.goldSoft,
          boxShadow: `0 0 10px 2px ${theme.gold}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundImage: `conic-gradient(from ${ringAngle}deg, ${theme.goldDeep}, ${theme.goldSoft}, ${theme.gold}, #FFF3CC, ${theme.goldDeep})`,
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
            {count}
          </div>
        </div>
      </div>
    </div>
  );
};
