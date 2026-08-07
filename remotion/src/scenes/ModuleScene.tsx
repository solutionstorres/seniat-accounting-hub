import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, Section } from "../theme";
import { display, body } from "../fonts";

export const ModuleScene: React.FC<{ section: Section; index: number }> = ({ section, index }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fromLeft = index % 2 === 0;
  const shotEnter = spring({ frame: frame - 4, fps, config: { damping: 22, stiffness: 90 } });
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.09]);
  const pan = interpolate(frame, [0, durationInFrames], [0, fromLeft ? -22 : 22]);
  const textDelay = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const descDelay = spring({ frame: frame - 16, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill
        style={{
          flexDirection: fromLeft ? "row" : "row-reverse",
          alignItems: "center",
          padding: "0 96px",
          gap: 70,
        }}
      >
        <div style={{ width: 640, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: display,
              fontSize: 150,
              fontWeight: 700,
              color: "transparent",
              WebkitTextStroke: `3px ${COLORS.accent}80`,
              lineHeight: 1,
              opacity: enter,
              transform: `translateX(${interpolate(enter, [0, 1], [fromLeft ? -60 : 60, 0])}px)`,
            }}
          >
            {section.chapter}
          </div>
          <div
            style={{
              fontFamily: display,
              fontSize: 76,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: 1.05,
              marginTop: 6,
              opacity: textDelay,
              transform: `translateY(${interpolate(textDelay, [0, 1], [34, 0])}px)`,
            }}
          >
            {section.title}
          </div>
          <div style={{ height: 7, width: interpolate(textDelay, [0, 1], [0, 210]), background: COLORS.accent, marginTop: 24, borderRadius: 8 }} />
          <div
            style={{
              fontFamily: body,
              fontSize: 40,
              lineHeight: 1.4,
              color: COLORS.muted,
              marginTop: 28,
              opacity: descDelay,
              transform: `translateY(${interpolate(descDelay, [0, 1], [26, 0])}px)`,
            }}
          >
            {section.desc}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderRadius: 26,
            overflow: "hidden",
            border: `2px solid rgba(255,255,255,0.14)`,
            boxShadow: "0 50px 110px rgba(0,0,0,0.55)",
            transform: `translateY(${interpolate(shotEnter, [0, 1], [60, 0])}px) scale(${interpolate(shotEnter, [0, 1], [0.94, 1])})`,
            opacity: shotEnter,
            background: "#0B1B33",
          }}
        >
          <div style={{ height: 44, background: "#0B1B33", display: "flex", alignItems: "center", gap: 10, paddingLeft: 18 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 999, background: c }} />
            ))}
          </div>
          <div style={{ overflow: "hidden" }}>
            <Img
              src={staticFile(`shots/${section.shot}.jpg`)}
              style={{
                width: "100%",
                display: "block",
                transform: `scale(${zoom}) translateX(${pan}px)`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
