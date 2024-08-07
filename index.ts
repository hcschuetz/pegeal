import { Algebra, getGrade, MultiVector, productFlips } from "./Algebra";
import { makeLetterNames, makeNumberedNames } from "./ContextUtils";
import { WebGLContext } from "./generateWebGL";
import { EvalContext } from "./evalExpr";

const ctx = new WebGLContext(makeLetterNames(["x", "y", "z", "w"]));
const alg = new Algebra([1, 2.222, 3, 0], ctx);

// -----------------------------------------------------------------------------
// Usage Examples

const zero = alg.zero(), one = alg.one();
const [ex, ey, ez] = alg.basisVectors();
const I = alg.pseudoScalar();

// This does not work with a null vector in the basis:
// const Iinv = alg.pseudoScalarInv();
// const Iinv2 = alg.pseudoScalarInv();
// ctx.emit("// " + (Iinv === Iinv2 ? "identical" : "not identical"));

ctx.emit("\n// ---------------");
const mv =
  true
  ? ctx.mv("foo", {
      "1": "foo_scalar",
      x: "foo_x", y: "foo_y", z: "foo_z",
      xy: "foo_xy", xz: "foo_xz", yz: "foo_yx",
      xyz: "foo_xyz",
    })
  : ctx.mv("bar", {1: "S", x: "X", yz: "YZ", xyz: "PS"});

alg.gradeInvolution(mv);
alg.reverse(mv);
// alg.dual(mv); // does not work with null vector in the basis
for (let i = 0; i <= alg.nDimensions; i++) {
  alg.extractGrade(i, mv);
}

const result =
  alg.contractLeft(
    alg.wedgeProduct(ey, one),
    alg.wedgeProduct(
      alg.plus(alg.scale("2.0", ex), ex, ey, I, zero, alg.plus()),
      alg.negate(ctx.mv("myVec", {y: "1.0", x: "4.0", z: "3.0"})),
      alg.wedgeProduct(),
    )
  );

ctx.emit(`\n// result: ${result}`);

ctx.emit("\n// (ex ^ ez) _| mv")
alg.contractLeft(alg.wedgeProduct(ex, ez), mv);
ctx.emit("\n// ex _| (ez _| mv)")
alg.contractLeft(ex, alg.contractLeft(ez, mv));

const X = 1, Y = 2, Z = 4;
ctx.emit(`\n// extracted: ${mv.get(X|Y)}`);

const mv2 = ctx.mv("mv2", {x: "3", z: "2"});
const mv3 = ctx.mv("mv3", {xy: "3", xz: "2", zw: "8"});

ctx.emit(`\n// contractLeft`);
alg.contractLeft(mv2, mv2);
alg.contractLeft(mv3, mv3);
alg.contractLeft(mv2, mv3);
alg.contractLeft(mv3, mv2);

ctx.emit(`\n// contractRight`);
alg.contractRight(mv2, mv2);
alg.contractRight(mv3, mv3);
alg.contractRight(mv2, mv3);
alg.contractRight(mv3, mv2);

ctx.emit(`\n// scalarProd`);
alg.scalarProduct(mv2, mv2);
alg.scalarProductMV(mv2, mv2);
alg.scalarProduct(mv3, mv3);
alg.scalarProductMV(mv3, mv3);
ctx.emit(`\n// empty: ${alg.scalarProduct(mv2, mv3)}`);

ctx.emit(`\n// dotProd`);
alg.dotProduct(mv2, mv2);
alg.dotProduct(mv3, mv3);
ctx.emit(`\n// empty: ${alg.dotProduct(mv2, mv3)}`);

ctx.emit(`\n// geomProd`);
alg.geometricProduct(mv2, mv2);
alg.geometricProduct(mv3, mv3);
ctx.emit(`\n// ${alg.geometricProduct(mv2, mv3)}`);

ctx.emit(`\n// wedge`);
alg.wedgeProduct(mv2, mv2);
alg.wedgeProduct(mv3, mv3);
ctx.emit(`\n// ${alg.wedgeProduct(mv2, mv3)}`);

ctx.emit(`\n// norm, inverse (mv2):`);
alg.scalarProduct(mv2, alg.reverse(mv2));
alg.inverse(mv2);
ctx.emit(`\n// norm, inverse (mv3):`);
alg.scalarProduct(mv3, alg.reverse(mv3));
alg.inverse(mv3);

console.log("Generated Code:\n" + ctx.text);

/*
TODO support control structures.
In particular we need to support variable assignment
so that the same variable can be assigned in different paths
and the value is usable after the paths have joined.
(After the join the variable has the union of the components from each path.
components missing in a path must be set to 0.0 explicitly in that path.)
*/

console.log(`
================================================================================
`);

{
  const ctx = new EvalContext(makeLetterNames(["x", "y", "z"]));
  const alg = new Algebra([1,2,3], ctx);

  const v = ctx.mv({x: 4, y: 11});
  console.log("geomProd(v, v) = " + alg.geometricProduct(v, v));
  console.log("contractRight(v, v) = " + alg.contractRight(v, v));

  const bv = ctx.mv({xy: 3, yz: 5});
  console.log("geomProd(bv, v) = " + alg.geometricProduct(bv, v));
  console.log("geomProd(v, bv) = " + alg.geometricProduct(v, bv));
  console.log("geomProd(bv, bv) = " + alg.geometricProduct(bv, bv));
  console.log(`
It is not a coincidence that the xz component of the latter product is 0.
It comes from using bv twice:

  geometricProduct(bv, bv).xz
  = bv.xy * bv.yz + bv.yz * bv.xy
  = bv.xy * bv.yz - bv.xy * bv.yz
  = 0

But the compiler does not understand this and does therefore not remove the
xz component from the result.

Same for

  geometricProduct(v, v).xy
  = v.x * v.y + v.y * v.x 
  = v.x * v.y - v.x * v.y
  = 0 

Even simpler (but less realistic) examples where the compiler does not
recognize that components will always be zero are the subtraction expressions

  bv - bv = ${alg.plus(bv, alg.negate(bv))}

and

  v - v = ${alg.plus(v, alg.negate(v))}.

----
`);

  console.log(""+v, ""+alg.reverse(v));
  console.log(""+bv, ""+alg.reverse(bv));
  console.log("geometricProd(v, ~v): " + alg.geometricProduct(v, alg.reverse(v)));
  console.log("geometricProd(bv, ~bv): " + alg.geometricProduct(bv, alg.reverse(bv)));
  console.log("scalarProd(v, ~v): " + alg.scalarProduct(v, alg.reverse(v)));
  console.log("scalarProd(bv, ~bv): " + alg.scalarProduct(bv, alg.reverse(bv)));
  console.log("-----");
  console.log("scalarProd(v, v): " + alg.scalarProduct(v, v));
  console.log("scalarProd(bv, bv): " + alg.scalarProduct(bv, bv));
  console.log("contractLeft(v, bv): " + alg.contractLeft(v, bv));
  console.log("contractRight(bv, v): " + alg.contractRight(bv, v));
  console.log("dotProduct(v, v): " + alg.dotProduct(v, v));
  console.log("dotProduct(bv, bv): " + alg.dotProduct(bv, bv));
  console.log("-----");
  console.log("normSquared(v): " + alg.normSquared(v));
  console.log("normSquared(bv): " + alg.normSquared(bv));
  console.log("inv(v): " + alg.inverse(v));
  console.log("inv(bv): " + alg.inverse(bv));
  console.log("-----");
  console.log("ps: " + alg.pseudoScalar());
  console.log("psi: " + alg.pseudoScalarInv());
  console.log("dual(v): " + alg.dual(v));
  console.log("dual(bv): " + alg.dual(bv));
}

{
  console.log(`
// --------------------------------------
// An example where my simple normalizability test fails:
// (See doc/unsorted/normalisierbarkeit-von-multivektoren.md)
`);

  function isNormalizable(m: MultiVector<never>): boolean {
    const nonScalars: number[] = [];
    m.forComponents((bmA, valA) => m.forComponents((bmB, valB) => {
      // Test only needed for bmA !== bmB and even in that case we need it only
      // for (A, B) or (B, A), not for both:
      if (bmA >= bmB) return;

      const bm = bmA ^ bmB;
      if (!(getGrade(bm) & 2)) { // <--- The simple test
        // Actually the non-scalar component is twice the product,
        // but for our refined test we can omit the factor 2.
        const product = (productFlips(bmA, bmB) & 1 ? -1 : 1) * valA * valB;
        console.log(
          "record simple-test failure", bmA, bmB,
          ":", productFlips(bmA, bmB) & 1 ? -1 : 1, valA, valB,
          ":", product
        );
        nonScalars[bm] = (nonScalars[bm] ?? 0) + product;
      }
    }))
    console.log("non-scalars:", nonScalars);
    return nonScalars.every(val => val === 0); // <--- The refined test
    // The refined test should allow for roundoff errors.
  }

  const ctx = new EvalContext(makeLetterNames(["x", "y", "z", "w"]));
  const alg = new Algebra([1,1,1,1], ctx);

  const a = ctx.mv({x: 2, y: 3})
  const b = ctx.mv({z: 5, w: 7});

  const m = alg.geometricProduct(a, b);
  const mrev = alg.reverse(m);

  console.log("m: " + m);
  console.log("normalizable: ", isNormalizable(m));
  console.log("m~: " + mrev);
  console.log("mm~: " + alg.geometricProduct(m, mrev));
  console.log(
`// Notice that the simple normalizability test skipped
// some term combinations that became 0 in mm~,
// but not the component for "xyzw" (bitmap 15).`)
  console.log("|m|**2: " + alg.normSquared(m));
}
{
  console.log(
`
// --------------------------------------
// A context using component names like "e013"
`
  );

  const metric = [1, 1, 1, 1];
  const ctx = new EvalContext(makeNumberedNames(metric.length));
  const alg = new Algebra(metric, ctx);

  const m = ctx.mv({1: 7, e01: 3, e23: 5});
  console.log("m: " + m);
  console.log("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}
{
  console.log(
`
// --------------------------------------
// A context using component names like "e1_8_11"
`
  );

  const metric = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const ctx = new EvalContext(makeNumberedNames(metric.length, {scalar: "scalar", start: 1}));
  const alg = new Algebra(metric, ctx);

  const m = ctx.mv({scalar: 7, e1_11: 3, e2_13: 5});
  console.log("m: " + m);
  console.log("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}
{
  console.log(
`
// --------------------------------------
// Rotation example
`
  );

  const coords = "xyz".split("");
  const ctx = new EvalContext(makeLetterNames(coords));
  const alg = new Algebra(coords.map(() => 1), ctx);
  const [ex, ey, ez] = alg.basisVectors();

  const TAU = 2 * Math.PI;
  const P = ctx.mv({x: 1, y: 1, z: 3});
  const n = 16;
  for (let i = 0; i <= n; i++) {
    console.log();

    const phi = TAU * i/n;
    console.log(`phi: ${phi.toFixed(4)} = ${(phi/TAU*360).toFixed(2)}°`)
    const c = Math.cos(phi);

    // Half-angle formulas from [DFL09], p.257 or from
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
    console.log("R: " + R);
    const R2 = alg.extractGrade(2, R);
    const R2abs = Math.sqrt(alg.normSquared(R2).get0
    () ?? 0);
    const R0 = alg.extractGrade(0, R);
    const R0abs = Math.sqrt(R0.get(0) ?? 0);

    // Just trying out log computation.  It does not make much sense here where
    // we anyway start with an angle phi rather than a pair of vectors.
    const logR = alg.scale(Math.atan2(R2abs, R0abs) / R2abs, R2);
    console.log("logR: " + logR);
    // I hoped that this is phi (for phi < 180°), but it isn't quite.
    // TODO check why
    console.log("2*|logR|: " + (2*Math.sqrt(alg.normSquared(logR).get0() ?? 0)/TAU*360).toFixed(4) + "°");

    // TODO This computes an "xyz" component, which is = 0.  Get rid of this.
    // Use a specialized implementation for rotor application?
    // Or implement an optimizer for longer products?
    console.log("RPR~: " + alg.geometricProduct(R, P, alg.reverse(R)));
  }
}
