import { Algebra, MultiVector } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { EvalContext } from "../evalExpr";
import { p } from "./utils";

console.log(`// Inverse Check\n`);

const ctx = new EvalContext();
const coords = "xyzw";
const alg = new Algebra([1,3,1,-1], ctx, makeLetterNames(coords));

for (const v of [
  alg.mv("scalar", {1: 7}),
  alg.mv("a", {x: 7}),
  alg.mv("b", {w: 7}),
  // Some of these produce 0 components.
  alg.mv("c", {x: 3, y: 4}),
  alg.mv("d", {x: 3, w: 4}),
  alg.mv("e", {xy: 7}),
  alg.mv("f", {xw: 7}),
  alg.mv("g", {xw: 7, yw: 3}),
  alg.mv("h", {1: 4, xy: 7, xz: 3, yz: 2}),
  alg.geometricProduct(
    alg.mv("h", {1: 4, xy: 7, xz: 3, yz: 2}),
    alg.mv("h", {1: 4, xy: 7, xz: 3, yz: 2}),
  ),
  alg.geometricProduct(
    alg.mv("c", {x: 3, y: 4}),
    alg.mv("h", {1: 4, xy: 7, xz: 3, yz: 2}),
  ),
]) {
  p(`---------------`);
  p(`v: ${v}`);
  p(`inv(v): ${alg.inverse(v)}`);
  for (const [label, prod] of [
    ["inv(v)*v", alg.geometricProduct(alg.inverse(v), v)],
    ["v*inv(v)", alg.geometricProduct(v, alg.inverse(v))],
  ] as [string, MultiVector<never>][]) {
    p(`${label}: ${prod}`);
    if (alg.normSquared(alg.plus(prod, alg.negate(alg.one()))) > 1e-30) {
      throw "testing 'inverse' failed";
    }
  }
}
