import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function createIcon(path: string, viewBox = "0 0 24 24") {
  return ({ size = 20, className, ...props }: IconProps) => (
    <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {path.split("|").map((p, i) => {
        const [tag, ...attrs] = p.split(" ");
        if (tag === "path") return <path key={i} d={attrs.join(" ")} />;
        if (tag === "circle") {
          const c = attrs.join(" ").match(/cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/);
          return c ? <circle key={i} cx={c[1]} cy={c[2]} r={c[3]} /> : null;
        }
        if (tag === "line") {
          const l = attrs.join(" ").match(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
          return l ? <line key={i} x1={l[1]} y1={l[2]} x2={l[3]} y2={l[4]} /> : null;
        }
        if (tag === "rect") {
          const r = attrs.join(" ").match(/x="([^"]+)" y="([^"]+)" w="([^"]+)" h="([^"]+)"([^/]*)/);
          return r ? <rect key={i} x={r[1]} y={r[2]} width={r[3]} height={r[4]} rx={r[5]?.match(/rx="([^"]+)"/)?.[1] || "0"} /> : null;
        }
        if (tag === "polyline") return <polyline key={i} points={attrs.join(" ")} />;
        return null;
      })}
    </svg>
  );
}

export const Icons = {
  dashboard: createIcon("rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"|rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"|rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"|rect x=\"14\" y=\"14\" width=\"7\" height=\"7\""),
  activity: createIcon("polyline 22 12 18 12 15 21 9 3 6 12 2 12"),
  shield: createIcon("path M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"),
  alertTriangle: createIcon("path M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z|line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"|line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\""),
  checkCircle: createIcon("path M22 11.08V12a10 10 0 1 1-5.93-9.14|polyline 22 4 12 14.01 9 11.01"),
  bank: createIcon("rect x=\"2\" y=\"6\" width=\"20\" height=\"14\" rx=\"2\"|path M12 2L2 6h20z|line x1=\"8\" y1=\"12\" x2=\"8\" y2=\"16\"|line x1=\"12\" y1=\"12\" x2=\"12\" y2=\"16\"|line x1=\"16\" y1=\"12\" x2=\"16\" y2=\"16\""),
  search: createIcon("circle cx=\"11\" cy=\"11\" r=\"8\"|line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\""),
  bell: createIcon("path M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|path M13.73 21a2 2 0 0 1-3.46 0"),
  moreHorizontal: createIcon("circle cx=\"12\" cy=\"12\" r=\"1\"|circle cx=\"19\" cy=\"12\" r=\"1\"|circle cx=\"5\" cy=\"12\" r=\"1\""),
  arrowUp: createIcon("path M5 10l7-7m0 0l7 7m-7-7v18"),
  arrowDown: createIcon("path M19 14l-7 7m0 0l-7-7m7 7V3"),
  arrowRight: createIcon("polyline 9 18 15 12 9 6"),
  fileText: createIcon("path M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|polyline 14 2 14 8 20 8|line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"|line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\""),
  settings: createIcon("circle cx=\"12\" cy=\"12\" r=\"3\"|path M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"),
  users: createIcon("path M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|circle cx=\"9\" cy=\"7\" r=\"4\"|path M23 21v-2a4 4 0 0 0-3-3.87|path M16 3.13a4 4 0 0 1 0 7.75"),
  fingerprint: createIcon("path M12 2a10 10 0 0 1 10 10|path M2 12a10 10 0 0 1 10-10|path M12 12a2 2 0 0 1 2 2c0 1.1-.9 2-2 2|path M12 6v4|path M12 16v4"),
  globe: createIcon("circle cx=\"12\" cy=\"12\" r=\"10\"|line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"|path M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"),
  clock: createIcon("circle cx=\"12\" cy=\"12\" r=\"10\"|polyline 12 6 12 12 16 14"),
  trendingUp: createIcon("path M23 6l-9.5 9.5-5-5L1 18|path M17 6h6v6"),
  x: createIcon("line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"|line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\""),
  chevronDown: createIcon("polyline 6 9 12 15 18 9"),
  filter: createIcon("polyline 22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"),
  download: createIcon("path M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|polyline 7 10 12 15 17 10|line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\""),
  plus: createIcon("line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"|line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\""),
  mapPin: createIcon("path M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z|circle cx=\"12\" cy=\"10\" r=\"3\""),
  creditCard: createIcon("rect x=\"1\" y=\"4\" width=\"22\" height=\"16\" rx=\"2\" ry=\"2\"|line x1=\"1\" y1=\"10\" x2=\"23\" y2=\"10\""),
  barChart: createIcon("line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\"|line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\"|line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\""),
  send: createIcon("path M22 2L11 13|path M22 2l-7 20-4-9-9-4 20-7z"),
  receive: createIcon("path M2 2l20 11-9 4-4 9L2 2z"),
  wallet: createIcon("rect x=\"1\" y=\"4\" width=\"22\" height=\"16\" rx=\"2\"|path M1 8h22|circle cx=\"17\" cy=\"14\" r=\"1\""),
  refresh: createIcon("polyline 23 4 23 10 17 10|path M20.49 15a9 9 0 1 1-2.12-9.36L23 10"),
  sliders: createIcon("line x1=\"4\" y1=\"21\" x2=\"4\" y2=\"14\"|line x1=\"4\" y1=\"10\" x2=\"4\" y2=\"3\"|line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"12\"|line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"3\"|line x1=\"20\" y1=\"21\" x2=\"20\" y2=\"16\"|line x1=\"20\" y1=\"12\" x2=\"20\" y2=\"3\"|line x1=\"1\" y1=\"14\" x2=\"7\" y2=\"14\"|line x1=\"9\" y1=\"8\" x2=\"15\" y2=\"8\"|line x1=\"17\" y1=\"16\" x2=\"23\" y2=\"16\""),
  cpu: createIcon("rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"|rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"|line x1=\"9\" y1=\"1\" x2=\"9\" y2=\"4\"|line x1=\"15\" y1=\"1\" x2=\"15\" y2=\"4\"|line x1=\"9\" y1=\"20\" x2=\"9\" y2=\"23\"|line x1=\"15\" y1=\"20\" x2=\"15\" y2=\"23\"|line x1=\"20\" y1=\"9\" x2=\"23\" y2=\"9\"|line x1=\"20\" y1=\"14\" x2=\"23\" y2=\"14\"|line x1=\"1\" y1=\"9\" x2=\"4\" y2=\"9\"|line x1=\"1\" y1=\"14\" x2=\"4\" y2=\"14\""),
  database: createIcon("path M12 2c4.97 0 9 1.34 9 3v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5c0-1.66 4.03-3 9-3z|path M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5|path M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"),
  layers: createIcon("path M12 2L2 7l10 5 10-5-10-5z|path M2 17l10 5 10-5|path M2 12l10 5 10-5"),
  shieldCheck: createIcon("path M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|polyline 9 12 11 14 15 10"),
  listChecks: createIcon("line x1=\"10\" y1=\"6\" x2=\"21\" y2=\"6\"|line x1=\"10\" y1=\"12\" x2=\"21\" y2=\"12\"|line x1=\"10\" y1=\"18\" x2=\"21\" y2=\"18\"|polyline 3 6 4 7 6 5|polyline 3 12 4 13 6 11|polyline 3 18 4 19 6 17"),
  nodes: createIcon("circle cx=\"18\" cy=\"5\" r=\"3\"|circle cx=\"6\" cy=\"12\" r=\"3\"|circle cx=\"18\" cy=\"19\" r=\"3\"|line x1=\"8.59\" y1=\"13.51\" x2=\"15.42\" y2=\"17.49\"|line x1=\"15.41\" y1=\"6.51\" x2=\"8.59\" y2=\"10.49\""),
  play: createIcon("polygon 5 3 19 12 5 21 5 3"),
  pause: createIcon("rect x=\"6\" y=\"4\" width=\"4\" height=\"16\"|rect x=\"14\" y=\"4\" width=\"4\" height=\"16\""),
};
