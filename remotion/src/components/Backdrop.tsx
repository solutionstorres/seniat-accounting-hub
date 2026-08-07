import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  const drift2 = Math.cos(frame / 120) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${18 + drift / 10}% ${20 + drift2 / 20}%, ${COLORS.bgAlt} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(700px 600px at ${85 - drift / 12}% ${80 + drift / 25}%, rgba(29,111,224,0.35) 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          transform: `translate(${drift / 6}px, ${drift2 / 8}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -160,
          top: 240 + drift,
          width: 420,
          height: 420,
          borderRadius: 999,
          border: `2px solid ${COLORS.accent}33`,
        }}
      />
    </AbsoluteFill>
  );
};
