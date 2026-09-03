import logo from "../../assets/logo.png";

// Geometry measured from the approved 1024×1024 asset (1-px alpha scan: artwork
// bbox 297,140 → 726,697 = 430×558 px, padded ~6 px so no artwork edge is clipped).
// The canvas is mostly transparent padding; the artwork is horizontally centered
// but sits above the vertical midpoint, so a plain square <img> renders the shield
// far too small and off-center. Paint only the artwork region instead.
const ARTWORK = {
  widthFrac: 0.4316, // (430 + 12) / 1024 — padded artwork width / canvas width
  heightFrac: 0.5566, // (558 + 12) / 1024 — padded artwork height / canvas height
  centerYFrac: 0.4087, // artwork vertical center / canvas height (418.5 / 1024)
};

interface PawGuardLogoProps {
  size?: number;
  alt?: string;
}

const PawGuardLogo = ({ size = 34, alt = "PawGuard" }: PawGuardLogoProps) => {
  // Scale the canvas so the artwork height equals `size`, box to the artwork's
  // aspect, and position the artwork center on the box center. `size` is the
  // visible artwork height, so every call site keeps its visual intent.
  const canvasPx = size / ARTWORK.heightFrac;
  const boxW = Math.round(size * (ARTWORK.widthFrac / ARTWORK.heightFrac));
  const posY = Math.round(
    (100 * (0.5 - ARTWORK.centerYFrac * (canvasPx / size))) /
      (1 - canvasPx / size)
  );
  return (
    <span
      role="img"
      aria-label={alt}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: boxW,
        height: size,
        backgroundImage: `url(${logo})`,
        backgroundSize: `auto ${Math.round(canvasPx)}px`,
        backgroundPosition: `50% ${posY}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
};

export default PawGuardLogo;
