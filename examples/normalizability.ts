import { Algebra, bitCount, Multivector, productFlips } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { EvalBackEnd } from "../src/evalExpr";
import { euclidean, p } from "./utils";

p(`// An example where my simple normalizability test fails:
// (See doc/unsorted/normalisierbarkeit-von-multivektoren.md)
`);

// TODO Is this still an issue?

function isNormalizable(m: Multivector<never>): boolean {
  const nonScalars: number[] = [];
  for (const [bmA, valA] of m) {
    for (const [bmB, valB] of m) {
      // Test only needed for bmA !== bmB and even in that case we need it only
      // for (A, B) or (B, A), not for both:
      if (bmA >= bmB) continue;

      const bm = bmA ^ bmB;
      if (!(bitCount(bm) & 2)) { // <--- The simple test
        // Actually the non-scalar component is twice the product,
        // but for our refined test we can omit the factor 2.
        const product = (productFlips(bmA, bmB) & 1 ? -1 : 1) * valA * valB;
        p(
          "record simple-test failure", bmA, bmB,
          ":", productFlips(bmA, bmB) & 1 ? -1 : 1, valA, valB,
          ":", product
        );
        nonScalars[bm] = (nonScalars[bm] ?? 0) + product;
      }
    }
  }
  p("non-scalars:", nonScalars);
  return nonScalars.every(val => val === 0); // <--- The refined test
  // The refined test should allow for roundoff errors.
}

const coords = "xyzw";
const be = new EvalBackEnd();
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

const a = alg.mv("a", {x: 2, y: 3})
const b = alg.mv("b", {z: 5, w: 7});

const m = alg.geometricProduct(a, b);
const mrev = alg.reverse(m);

p("m: " + m);
p("normalizable: ", isNormalizable(m));
p("m~: " + mrev);
p("mm~: " + alg.geometricProduct(m, mrev));
p(
`// Notice that the simple normalizability test skipped
// some term combinations that became 0 in mm~,
// but not the component for "xyzw" (bitmap 15).`)
p("|m|: " + alg.norm(m));
