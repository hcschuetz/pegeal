import { Multivector } from "../src/Algebra";

export const euclidean = (coords: number | string | string[]) =>
  (
    typeof coords === "number" ? Array.from({length: coords}) :
    typeof coords === "string" ? coords.split("") :
    coords
  ).map(() => 1);

export const TAU = 2 * Math.PI;
export const deg = (x: number, p?: number) => `${(x * (360 / TAU)).toFixed(p)}°`;

export const p = console.log;
export const q_ = (coords: string) => <T>(label: string, x: Multivector<T> | number | string | undefined) => {
  switch (typeof x) {
    case "undefined":
    case "string":
      p(label + " = " + x);
      return;
    case "number":
      p(label + " = " + x.toFixed(8).replace(/\.?0*$/, ""));
      return;
    default:
      p(label + " =" + (x.knownUnit ? " [unit]" : ""));
      for (const [bm, val] of x) {
        p(`  ${
          coords.split("").map((c, i) => (1 << i) & bm ? c : "_").join("")
        }: ${
          typeof val === "number"
          ? val.toFixed(8).replace(/^(?!-)/, "+").replace(/\.?0*$/, "")
          : val
        }`);
      }
    }
}
