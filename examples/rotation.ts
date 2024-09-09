import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { deg, euclidean, p, TAU } from "./utils";

p(`// Rotation example
// (see also "Rotor Log" examples)\n`);

const coords = "xyz";
const be = new DummyBackEnd();
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));
const [ex, ey, ez] = alg.basisVectors();

const P = alg.mv("P", {x: 1, y: 1, z: 3});
const n = 16;
for (let i = 0; i <= n; i++) {
  p();

  const phi = TAU * i/n;
  p(`phi: ${phi.toFixed(4)} = ${deg(phi, 2)}`)
  const c = Math.cos(phi);

  // Half-angle formulas from [DFM09], p.257 or from
  // https://en.wikipedia.org/wiki/List_of_trigonometric_identities#Half-angle_formulae
  // or easily derivable:
  const cHalf = Math.sqrt((1 + c)/2), sHalf = Math.sqrt((1 - c)/2);

  const R = alg.plus(
    alg.scale(cHalf, alg.one()),
    alg.scale(sHalf,
      alg.wedgeProduct(
        // ex,
        alg.scale(Math.SQRT1_2, alg.plus(ex, ey)),
        ez,
      ),
    )
  );
  p("R: " + R);
  const R2 = alg.extractGrade(2, R);
  const R2abs = alg.norm(R2);
  const R0 = R.value(0);

  // Just trying out log computation.  It does not make much sense here where
  // we anyway start with an angle phi rather than a pair of vectors.
  const logR = alg.scale(Math.atan2(R2abs, R0) / R2abs, R2);
  p("logR: " + logR);
  // For phi <= 180° this is phi.
  // For phi >= 180° this is 360° - phi.
  p("2*|logR|: " + deg(2*(alg.norm(logR)), 4));

  // TODO This computes an "xyz" component, which is = 0.  Get rid of this.
  // Use a specialized implementation for rotor application?
  // Or implement an optimizer for longer products?
  p("RPR~: " + alg.geometricProduct(R, P, alg.reverse(R)));
}
