import { DEPARTMENTS } from "@/lib/validate";
import { colourVar } from "@/lib/colours";

// The eight department colours as a row of dots.
export default function Palette({ thin = false }: { thin?: boolean }) {
  return (
    <div className={`palette${thin ? " thin" : ""}`} aria-hidden="true">
      {DEPARTMENTS.map((d) => (
        <span key={d} style={colourVar(d)} />
      ))}
    </div>
  );
}
