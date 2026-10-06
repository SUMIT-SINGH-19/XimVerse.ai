/**
 * Decorative halftone artwork: a planet with two orbits, drawn as a grid of
 * square dots whose size follows the shape. Echoes the logo's planet mark.
 *
 * Computed once at render on the server — no client JavaScript.
 */

const SIZE = 640;
const CELL = 11;
const TILT = (-28 * Math.PI) / 180;

const ORBITS = [
  { a: 0.98, b: 0.36, width: 0.11 },
  { a: 0.8, b: 0.27, width: 0.07 },
];
const PLANET_R = 0.46;

interface Dot {
  x: number;
  y: number;
  s: number;
  tone: "orange" | "teal";
}

function buildDots(): Dot[] {
  const dots: Dot[] = [];
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);

  for (let y = CELL / 2; y < SIZE; y += CELL) {
    for (let x = CELL / 2; x < SIZE; x += CELL) {
      // Normalised coords, centre of the square = (0, 0), edges at ±1.
      const nx = (x / SIZE) * 2 - 1;
      const ny = (y / SIZE) * 2 - 1;
      const u = nx * cos - ny * sin;
      const v = nx * sin + ny * cos;

      let orbit = 0;
      for (const o of ORBITS) {
        const d = Math.abs(Math.hypot(u / o.a, v / o.b) - 1);
        orbit = Math.max(orbit, 1 - d / o.width);
      }
      // Orbits pass in front of the planet only on their lower half.
      const r = Math.hypot(nx, ny);
      const behind = r < PLANET_R && v < 0;
      if (behind) orbit = 0;

      let planet = 0;
      if (r < PLANET_R) {
        // Denser towards the upper-left, like a lit sphere.
        const light = 1 - Math.hypot(nx + 0.18, ny + 0.2) / (PLANET_R * 1.5);
        planet = 0.25 + 0.6 * Math.max(0, light);
      }

      const tone = orbit > planet ? "orange" : "teal";
      const intensity = Math.max(orbit, planet);
      if (intensity <= 0.08) continue;

      const s = CELL * 0.82 * Math.min(1, intensity);
      if (s < 1.2) continue;
      dots.push({ x: x - s / 2, y: y - s / 2, s, tone });
    }
  }
  return dots;
}

const DOTS = buildDots();

export function OrbitDots({ className = "" }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} aria-hidden>
      <g fill="var(--teal)">
        {DOTS.filter((d) => d.tone === "teal").map((d, i) => (
          <rect key={i} x={d.x.toFixed(1)} y={d.y.toFixed(1)} width={d.s.toFixed(1)} height={d.s.toFixed(1)} />
        ))}
      </g>
      <g fill="var(--orange)">
        {DOTS.filter((d) => d.tone === "orange").map((d, i) => (
          <rect key={i} x={d.x.toFixed(1)} y={d.y.toFixed(1)} width={d.s.toFixed(1)} height={d.s.toFixed(1)} />
        ))}
      </g>
    </svg>
  );
}
