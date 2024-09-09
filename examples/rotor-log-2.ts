import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { deg, euclidean, p, q_ } from "./utils";

p(`// Rotor Log -  Eval\n`);

const coords = "xyz";
const be = new DummyBackEnd();
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

const q = q_(coords);

const v1 = alg.normalize(alg.mv("v1", {x: 1, y: 1}));
q("v1", v1);
const v2 = alg.normalize(alg.mv("v2", {x: 1, y: 1, z: 1}));
q("v2", v2);
const vMid = alg.normalize(alg.plus(v1, v2));
q("vMid", vMid);
q("angle  ", deg(alg.getAngle(v1, v2), 5));
q("angle/2", deg(alg.getAngle(v1, vMid), 5));
q("angle/2", deg(alg.getAngle(vMid, v2), 5));
const rotor1 = alg.geometricProduct(vMid, v1);
const rotor2 = alg.geometricProduct(v2, vMid);
q("dist(R1, R2)", alg.dist(rotor1, rotor2));
const rotor = rotor1;
q("R", rotor);
q("|R|", alg.norm(rotor));

q("dist(R v1 R~, v2)",
  alg.dist(alg.geometricProduct(rotor, v1, alg.reverse(rotor)), v2)
);

const log = alg.log(rotor);
q("log(rotor)", log);

// Cannot compare with [DFM09]'s reference implementation because that does
// not provide a multivector logarithm, not even for specific cases.
// Instead we check if log is the inverse function of exp.
q("dist(exp(log(rotor)), rotor)", alg.dist(alg.exp(log), rotor));

// Interpolation of an angle spanned by two vectors
const a12 = alg.getAngle(v1, v2);
const inv_sin_a12 = 1 / Math.sin(a12);
const slerpArc = alg.slerp(v1, v2);
const n = 10;
for (let i = 0; i <= n; i++) {
  p();
  const frac = i/n;
  q("frac", frac);
  const partialRotor = alg.exp(alg.scale(frac, log));
  // q("PR", partialRotor);
  // q("|PR|", alg.norm(partialRotor).get(0));
  const v = alg.geometricProduct(partialRotor, v1, alg.reverse(partialRotor))
  q("v", v);
  // TODO can the computation of v be optimized by using lower-level operations?
  // See the Wikipedia article on "Slerp".

  // control the result:
  const a1 = alg.getAngle(v1, v), a2 = alg.getAngle(v, v2);
  q("angle frac 1", a1 / a12);
  q("angle frac 2", a2 / a12);

  // TODO use a testing lib
  if (Math.abs(a12 * frac - a1) > 1e-8) throw new Error("angle test failed");
  if (Math.abs(a12 - a1 - a2) > 1e-8) throw new Error("angle test failed");

  const slerp = slerpArc(frac);
  q("slerp", slerp);
  q("dist(slerp, v)", alg.dist(slerp, v));
}
