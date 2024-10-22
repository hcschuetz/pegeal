import { Algebra, bitCount, fail, Multivector } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { euclidean } from "../src/euclidean";
import NumericBackEnd from "../src/NumericBackEnd.js";
import { log_, mapEntries, p} from "./utils";


const be = new NumericBackEnd();

// B: base space
const coordsB = "xy"
const B = new Algebra(euclidean(coordsB), be, makeLetterNames(coordsB));
const logB = log_(coordsB);

// R: representation space
const coordsR = coordsB + "pm"; // "e_plus"/"e_minus" directions
const R = new Algebra(euclidean(coordsB).concat([1, -1]), be, makeLetterNames(coordsR));
const logR = log_(coordsR);

/** Convert a base-space 1-vector to a representation-space 1-vector */
function b2r(mv: Multivector<never>) {
  return new Multivector(R, add => {
    for (const [bm, val] of mv) {
      if (bitCount(bm) === 1) {
        add(bm, val);
      } else if (Math.abs(val) > 1e-8) {
        fail("baseToRepr: not a 1-vector");
      } // else ignore almost-zero non-grade-1 component
    }
    const i = 0.5 * B.normSquared(mv);
    add("m", i + 0.5);
    add("p", i - 0.5);
  }, {named: mv.name + "R"});
}

/** Convert a representation-space 1-vector to a base-space 1-vector */
function r2b(mv: Multivector<never>) {
  const result = new Multivector(B, add => {
    const o = (mv.value("m") - mv.value("p"));
    const scale = 1 / o;
    for (const [bm, val] of mv) {
      if (bitCount(bm) === 1) {
        if (!["p", "m"].includes(R.bitmapToString[bm])) {
          add(bm, scale * val);
        }
      } else if (Math.abs(val) > 1e-8) {
        fail("reprToBase: not a 1-vector");
      } // else ignore almost-zero non-grade-1 component
    }
  }, {named: mv.name + "B"});
  return result;
}

const ei = R.mv({m: 1, p: 1}, {named: "ei"}); // infinity
const eo = b2r(B.zero());     // origin

// --------------------------------------------------------------

// Notice that the normals are *not* constructed as base-space vectors and
// converted with b2r, but directly as representation-space vectors.

// Line defined by unit normal and distance from the origin:
const line1 = R.plus(
  R.mv({x: 0, y: 1}),
  R.scale(1, ei),
);

// We can also define a line using the point closest to the (R) origin:
const normal2 = R.mv({x: 2, y: 2});
const line2 = R.plus(R.inverse(normal2), ei);

// While the two lines are given as ker(.line1) and ker(.line2),
// the point pair is given as ker(^intersection).
const intersection = R.dual(R.wedgeProduct(line1, line2));

// One of the two intersection points is ei.  Eliminiate it by contracting
// with eo (due to the "cross metric").  The finite point remains:
const finite = R.contractLeft(eo, intersection);

logR({line1, line2, finite});
logB({finiteB: r2b(finite)});

p("-------------------------");

// The circle around (1, 2) with radius 5 given as ker(.circle):
const centerB = B.vec([1, 2]);
const center = b2r(centerB);
const circle = R.plus(center, R.scale(-.5 * 5**2, ei));

// pair of intersection points between line2 and circle given as ker(^pp):
const pp = R.dual(R.wedgeProduct(line2, circle));

// decompose the pair:
const pp_squared = Math.sqrt(R.scalarProduct(pp, pp));
const [p1, p2] = [-pp_squared, pp_squared].map(n =>
  R.geometricProduct(
    R.plus(pp, R.scale(n, R.one())),
    R.inverse(R.contractLeft(R.negate(ei), pp))
  )
);

const [p1B, p2B] = [p1, p2].map(r2b);

const normal2B = B.vec([2, 2]);

logB({
  p1B, p2B,
  // check orthogonality:
  ortho1: B.scalarProduct(normal2B, B.minus(p1B, normal2B)),
  ortho2: B.scalarProduct(normal2B, B.minus(p2B, normal2B)),
  // check distances:
  dist1: B.norm(B.minus(p1B, centerB)),
  dist2: B.norm(B.minus(p1B, centerB)),
});

p(`----------`);

// Or do the checks in R:
logR({
  // check orthogonality:
  ortho1: R.scalarProduct(normal2, R.minus(p1, normal2)),
  ortho2: R.scalarProduct(normal2, R.minus(p2, normal2)),
  // check distances:
  dist1: Math.sqrt(-2 * R.scalarProduct(p1, center)),
  dist2: Math.sqrt(-2 * R.scalarProduct(p2, center)),
});
