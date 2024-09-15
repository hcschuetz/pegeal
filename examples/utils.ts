import { Multivector } from "../src/Algebra";

export const TAU = 2 * Math.PI;
export const deg = (x: number, p?: number) => `${(x * (360 / TAU)).toFixed(p)}°`;

export const p = console.log;

export const q_ = (
  coords: string,
  write: (text: string) => void = console.log,
) => <T>(
  label: string,
  x: Multivector<T> | number | string | undefined,
) => {
  switch (typeof x) {
    case "undefined":
    case "string":
      write(label + " = " + x);
      return;
    case "number":
      write(label + " = " + x.toFixed(8).replace(/\.?0*$/, ""));
      return;
    default:
      write(label + " =" + (x.knownUnit ? " [unit]" : ""));
      for (const [bm, val] of x) {
        write(`  ${
          coords.split("").map((c, i) => (1 << i) & bm ? c : "_").join("")
        }: ${
          typeof val === "number"
          ? val.toFixed(8).replace(/^(?!-)/, "+").replace(/\.?0*$/, "")
          : val
        }`);
      }
    }
}
