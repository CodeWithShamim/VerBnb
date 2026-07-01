"use client";

/**
 * Colorful animated mesh-gradient background for the hero. Pure CSS blobs that
 * drift slowly; sits behind content with low opacity. No JS work per frame.
 */
export default function MeshBackground() {
  return (
    <div className="mesh" aria-hidden>
      <div
        className="mesh-blob"
        style={{
          width: 480,
          height: 480,
          top: "-8%",
          left: "8%",
          background: "radial-gradient(circle, #a06bff, transparent 70%)",
          animationDelay: "0s",
        }}
      />
      <div
        className="mesh-blob"
        style={{
          width: 420,
          height: 420,
          top: "10%",
          right: "6%",
          background: "radial-gradient(circle, #22d3ee, transparent 70%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="mesh-blob"
        style={{
          width: 440,
          height: 440,
          bottom: "-12%",
          left: "32%",
          background: "radial-gradient(circle, #f472b6, transparent 70%)",
          animationDelay: "-12s",
        }}
      />
      <div
        className="mesh-blob"
        style={{
          width: 360,
          height: 360,
          bottom: "-4%",
          right: "26%",
          background: "radial-gradient(circle, #34d399, transparent 70%)",
          animationDelay: "-3s",
        }}
      />
    </div>
  );
}
