import type { CSSProperties } from "react";

// One pastel hue per department, taken from the CueBoard Pastel design.
const HUE: Record<string, number> = {
  Logistics: 60,
  Hospitality: 15,
  "Stage & Programme": 285,
  "Tech & AV": 240,
  "Marketing & Social": 105,
  "Finance & Sponsors": 330,
  "Volunteers & Crowd": 195,
  "Safety & Medical": 150,
};

export const deptColour = (name: string) => `oklch(0.86 0.09 ${HUE[name] ?? 60})`;

// Lets a CSS class pick up the department's colour as var(--c).
export const colourVar = (name: string) => ({ "--c": deptColour(name) }) as CSSProperties;
