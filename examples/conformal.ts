import { Algebra, bitCount, fail, Multivector } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { euclidean } from "../src/euclidean";
import NumericBackEnd from "../src/NumericBackEnd.js";
import { log_, mapEntries, p} from "./utils";

// -----------------------------------------------------------------------------
// Conformal-Geometric-Algebra machinery setup

// TODO Support symbolic computation (= code generation) in some of this code
// and move it to a CGA-utilities module.

const be = new NumericBackEnd();

// Suffix B for identifiers related to the base space
const coordsB = "xyz"
const algB = new Algebra(euclidean(coordsB), be, makeLetterNames(coordsB));
const logB = log_(coordsB);

// Suffix R for identifiers related to the representation space
const coordsR = coordsB + "pm"; // "e_plus"/"e_minus" directions
const algR = new Algebra(euclidean(coordsB).concat([1, -1]), be, makeLetterNames(coordsR));
const logR = log_(coordsR);

/** Convert a base-space 1-vector to a representation-space 1-vector */
function baseToRepr(mv: Multivector<never>) {
  return new Multivector(algR, add => {
    for (const [bm, val] of mv) {
      if (bitCount(bm) === 1) {
        add(bm, val);
      } else if (Math.abs(val) > 1e-8) {
        fail("baseToRepr: not a 1-vector");
      } // else ignore almost-zero non-grade-1 component
    }
    const i = 0.5 * algB.normSquared(mv);
    add("m", i + 0.5);
    add("p", i - 0.5);
  }, {nameHint: mv.name + "R"});
}

/** Convert a representation-space 1-vector to a base-space 1-vector */
function reprToBase(mv: Multivector<never>) {
  const result = new Multivector(algB, add => {
    const o = (mv.value("m") - mv.value("p"));
    const scale = 1 / o;
    for (const [bm, val] of mv) {
      if (bitCount(bm) === 1) {
        if (!["p", "m"].includes(algR.bitmapToString[bm])) {
          add(bm, scale * val);
        }
      } else if (Math.abs(val) > 1e-8) {
        fail("reprToBase: not a 1-vector");
      } // else ignore almost-zero non-grade-1 component
    }
  }, {nameHint: mv.name + "B"});
  return result;
}

const ei = algR.mv({m: 1, p: 1}, {nameHint: "ei"}); // infinity
const eo = baseToRepr(algB.zero());     // origin

const normalizeBivector = (bv: Multivector<never>) =>
  algR.scale(1 / bv.value("pm"), bv);

  
// While the machinery *setup* above used coordinates p and m (for the basis
// vectors e_plus and e_minus), the machinery *usage* below does not rely on
// this implementation detail.  Only the basis vectors ei and eo are used.
//
// Unfortunately various multivectors below will store replicated component
// values due to the the p/m representation.  Can we optimize this away?
// If we emit code instead of using NumericBackEnd, can we expect the next
// compilation step to optimize this away?

// -----------------------------------------------------------------------------
// Example: Intersect a line with a plane.
// (See also [PH04], section 3.6.6.3;
// http://www.gaalop.de/dhilden_data/CLUScripts/gatpdf.pdf)

const relativePoints = {
  a: [ 0, -1, -1],
  b: [ 0,  3,  3],

  c: [ 2,  1, -4],
  d: [ 1, -1, -2],
  e: [-1, -2,  2],
};

// With the values above line (a,b) and plane (c,d,e) intersect at the origin.
// We move all the points to get a "more interesting" intersection point.
const offsetB = algB.vec([2, 5, -3], {nameHint: "offset"});

const pointsB = mapEntries(relativePoints,
  (val, key) => algB.plus(offsetB, algB.vec(val, {nameHint: key}))
);

// line and plane intersect in a conformal point pair consisting of ei and
// the finite point given as offset above.  So we wedge these points.
const expected = algR.wedgeProduct(ei, baseToRepr(offsetB));

// At this point the example setup is done.  We now demonstrate
// - how to construct a line and a plane,
// - how to intersect them, and
// - how to extract the finite point from the intersection point pair.

const pointsR = mapEntries(pointsB, baseToRepr);

const line  = algR.wedgeProduct(pointsR.a, pointsR.b, ei);
const plane = algR.wedgeProduct(pointsR.c, pointsR.d, pointsR.e, ei);

// For intersecting the line and the plane [PH04] and [DFM09] use a combination
// of dualization and contraction, which we would write like this:
//   const intersection = algR.contractLeft(algR.dual(plane), line);
// But the regressive product makes it clearer
// - that the plane and the line might be exchanged,
// - that we could just as easily intersect three planes, and
// - that the operation is non-metric.
// (Using the regressive product as a "meet" operation requires that the
// arguments span the entire space.)
const intersection = algR.regressiveProduct(plane, line);

// To compare with the expected value we normalize the intersection:
const intersectionNormalized = normalizeBivector(intersection);

// Remove ei from the intersection point pair
// (contracting with eo because of the "cross metric" between ei and eo)
// so that the finite intersection point remains:
const intersectionFinitePoint = algR.contractLeft(eo, intersection);

// We can convert this to a base-space vector within algR with coordinate-free
// operations:
const intersectionXYZinR =
  algR.minus(
    algR.scale(
      1 / -algR.scalarProduct(ei, intersectionFinitePoint),
      intersectionFinitePoint
    ),
    eo,
  );

// We can also simply convert the point to algB:
const intersectionB = reprToBase(intersectionFinitePoint);

logR({
  // ei, eo,
  // ...pointsR,
  line,
  plane,
  intersection,
  intersectionNormalized,
  expected,
  intersectionFinitePoint,
  intersectionXYZinR,
});
logB({intersectionB});
