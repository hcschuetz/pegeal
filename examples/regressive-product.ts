import { Algebra, Multivector } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { euclidean } from "../src/euclidean";
import NumericBackend from "../src/NumericBackEnd.js";
import { mapEntries, p, q_ } from "./utils";


// This example is not only about the regressive product,
// but also about the interaction between two algebras
// (a plain Euclidean algebra and the corresponding
// homogeneous/projective algebra).

const be = new NumericBackend();

// Use suffix E for identifiers related to the Euclidean 3D space
const coordsE = "xyz"
const algE = new Algebra(euclidean(coordsE), be, makeLetterNames(coordsE));
const qE = q_(coordsE);

// Use suffix P for identifiers related to the projective (3+1)D space
const coordsP = coordsE + "w";
const algP = new Algebra(euclidean(coordsP), be, makeLetterNames(coordsP));
const qP = q_(coordsP);

const [,,,ew] = algP.basisVectors();
const Id3 = [[1], [,1], [,,1]];

/** Convert a 3D vector to a (3+1)D projective vector */
const input = (mv: Multivector<never>) => algP.plus(ew, algP.outermorphism(Id3, mv));

/** Convert a (3+1)D projective vector to a 3D vector */
const output = (mv: Multivector<never>) =>
  algE.outermorphism(Id3, algP.scale(algP.scalarOp("/", 1, mv.value("w")), mv));

const [A1E, A2E, A3E, A4E, XE] = Object.entries({
  A1: [3, 1, 5],
  A2: [2, 2, 5],
  A3: [2, 1, 4],
  A4: [2, 1, 5],
  X : [4, 3, 4],
}).map(([k, v]) => algE.vec(v, {nameHint: k}));

const [A1P, A2P, A3P, A4P, XP] = [A1E, A2E, A3E, A4E, XE].map(input);

// Intersection example essentially from
// https://gaalop.de/dhilden_data/CLUScripts/gatpdf.pdf, section 2.1.5

const planeP = algP.wedgeProduct(A1P, A2P, A3P);
const lineP = algP.wedgeProduct(A4P, XP);

// The regressive product returns the intersection (= meet) between plane and
// line in the general case where the join of plane and line is the pseudoscalar
// of the full (3+1)D projective space:
const intersectionP = algP.regressiveProduct(planeP, lineP);
qP("intersectionP", intersectionP);

const intersectionE = output(intersectionP);
qE("intersectionE", intersectionE);

p(`
----------------------
These should all be zero:
`);

qP("check intersection on plane (algP)", algP.wedgeProduct(intersectionP, planeP));
qP("check intersection on line  (algP)", algP.wedgeProduct(intersectionP, lineP));

const minusIntersectionE = algE.negate(intersectionE);
const fromIntersection = (mv: Multivector<never>) =>
  algE.plus(mv, minusIntersectionE);

qE("check intersection on plane (algE)", algE.wedgeProduct(
  fromIntersection(A1E),
  fromIntersection(A2E),
  fromIntersection(A3E),
));
qE("check intersection on line  (algE)", algE.wedgeProduct(
  fromIntersection(A4E),
  fromIntersection(XE ),
));
