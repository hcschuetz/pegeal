import fs from "node:fs";
import zlib from "node:zlib";
import binaryen from "binaryen";

import { Algebra, Context, bitCount, MultiVector, productFlips, Factor } from "./Algebra";
import { makeLetterNames, makeNumberedNames } from "./componentNaming";
import { WebGLContext } from "./generateWebGL";
import { EvalContext } from "./evalExpr";
import { WASMContext } from "./generateWASM";

const euclidean = (coords: number | string | string[]) =>
  (
    typeof coords === "number" ? Array.from({length: coords}) :
    typeof coords === "string" ? coords.split("") :
    coords
  ).map(() => 1);

const TAU = 2 * Math.PI;
const deg = (x: number, p?: number) => `${(x * (360 / TAU)).toFixed(p)}°`;

const p = console.log;
const q_ = (coords: string) => (label: string, x: MultiVector<never> | number | string | undefined) => {
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
        }: ${val.toFixed(8).replace(/^(?!-)/, "+").replace(/\.?0*$/, "")}`);
      }
    }
}

/** Copy multivector without the unit mark. */
const hideUnit = <T>(alg: Algebra<T>, mv: MultiVector<T>) =>
  alg.plus(alg.zero(), mv);

// -----------------------------------------------------------------------------
// Usage Examples

{
  const ctx = new WebGLContext();
  const alg = new Algebra([1, 2.222, 3, 0], ctx, makeLetterNames("xyzw"));

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
    ? alg.mv("foo", {
        "1": "foo_scalar",
        x: "foo_x", y: "foo_y", z: "foo_z",
        xy: "foo_xy", xz: "foo_xz", yz: "foo_yx",
        xyz: "foo_xyz",
      })
    : alg.mv("bar", {1: "S", x: "X", yz: "YZ", xyz: "PS"});

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
        alg.negate(alg.mv("myVec", {y: "1.0", x: "4.0", z: "3.0"})),
        alg.wedgeProduct(),
      )
    );

  ctx.emit(`\n// result: ${result}`);

  ctx.emit("\n// (ex ^ ez) _| mv")
  alg.contractLeft(alg.wedgeProduct(ex, ez), mv);
  ctx.emit("\n// ex _| (ez _| mv)")
  alg.contractLeft(ex, alg.contractLeft(ez, mv));

  const X = 1, Y = 2, Z = 4;
  ctx.emit(`\n// extracted: ${mv.value(X|Y)}`);

  const mv2 = alg.mv("mv2", {x: "3", z: "2"});
  const mv3 = alg.mv("mv3", {xy: "3", xz: "2", zw: "8"});

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

  p("Generated Code:\n" + ctx.text);

  /*
  TODO support control structures.
  In particular we need to support variable assignment
  so that the same variable can be assigned in different paths
  and the value is usable after the paths have joined.
  (After the join the variable has the union of the components from each path.
  components missing in a path must be set to 0.0 explicitly in that path.)
  */
}
p(`
================================================================================
`);
{
  const ctx = new EvalContext();
  const alg = new Algebra([1,2,3], ctx, makeLetterNames("xyz"));
  const q = q_("xyz");

  const v = alg.mv("v", {x: 4, y: 11});
  q("v", v);
  q("geomProd(v, v)", alg.geometricProduct(v, v));
  q("contractRight(v, v)", alg.contractRight(v, v));

  const bv = alg.mv("bv", {xy: 3, yz: 5});
  q("bv", bv);
  q("geomProd(bv, v)", alg.geometricProduct(bv, v));
  q("geomProd(v, bv)", alg.geometricProduct(v, bv));
  q("geomProd(bv, bv)", alg.geometricProduct(bv, bv));
  p(`
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

  p(""+v, ""+alg.reverse(v));
  p(""+bv, ""+alg.reverse(bv));
  p("geometricProd(v, ~v): " + alg.geometricProduct(v, alg.reverse(v)));
  p("geometricProd(bv, ~bv): " + alg.geometricProduct(bv, alg.reverse(bv)));
  p("scalarProd(v, ~v): " + alg.scalarProduct(v, alg.reverse(v)));
  p("scalarProd(bv, ~bv): " + alg.scalarProduct(bv, alg.reverse(bv)));
  p("-----");
  p("scalarProd(v, v): " + alg.scalarProduct(v, v));
  p("scalarProd(bv, bv): " + alg.scalarProduct(bv, bv));
  p("contractLeft(v, bv): " + alg.contractLeft(v, bv));
  p("contractRight(bv, v): " + alg.contractRight(bv, v));
  p("dotProduct(v, v): " + alg.dotProduct(v, v));
  p("dotProduct(bv, bv): " + alg.dotProduct(bv, bv));
  p("-----");
  p("normSquared(v): " + alg.normSquared(v));
  p("normSquared(bv): " + alg.normSquared(bv));
  p("inv(v): " + alg.inverse(v));
  p("inv(bv): " + alg.inverse(bv));
  p("-----");
  p("ps: " + alg.pseudoScalar());
  p("psi: " + alg.pseudoScalarInv());
  p("dual(v): " + alg.dual(v));
  p("dual(bv): " + alg.dual(bv));
}

{
  p(`
// --------------------------------------
// An example where my simple normalizability test fails:
// (See doc/unsorted/normalisierbarkeit-von-multivektoren.md)
`);

  // TODO Is this still an issue?

  function isNormalizable(m: MultiVector<never>): boolean {
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
  const ctx = new EvalContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

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
}
{
  p(
`
// --------------------------------------
// A context using component names like "e013"
`
  );

  const metric = euclidean(4);
  const ctx = new EvalContext();
  const alg = new Algebra(metric, ctx, makeNumberedNames(metric.length));

  const m = alg.mv("m", {1: 7, e01: 3, e23: 5});
  p("m: " + m);
  p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}
{
  p(
`
// --------------------------------------
// A context using component names like "e1_8_11"
`
  );

  const metric = euclidean(13);
  const ctx = new EvalContext();
  const alg = new Algebra(
    metric,
    ctx,
    makeNumberedNames(metric.length, {scalar: "scalar", start: 1})
  );

  const m = alg.mv("m", {scalar: 7, e1_11: 3, e2_13: 5});
  p("m: " + m);
  p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}
{
  p(
`
// --------------------------------------
// Rotation example
// (see also "Rotor Log" examples below)
`
  );

  const coords = "xyz";
  const ctx = new EvalContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));
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
}
{
  p(
`
// --------------------------------------
// Homogeneous coords
`
  );

  const metric = euclidean(4);
  const ctx = new WebGLContext();
  const alg = new Algebra(metric, ctx, makeNumberedNames(metric.length));
  const [e0, e1, e2, e3] = alg.basisVectors();
  const e0Inv = alg.inverse(e0);

  const point = alg.mv("point", {e0: "3", e1: "6", e2: "9", e3: "+++"});

  // With our optimizations (and the expected optimizations by the WebGL
  // compiler) the extractions of weight and location should be as efficient
  // as in hand-written code:
  const p_weight = alg.contractLeft(e0Inv, point);
  const p_loc = alg.geometricProduct(
    alg.contractLeft(e0Inv, alg.wedgeProduct(e0, point)),
    alg.inverse(p_weight),
  );

  p(ctx.text)
}
{
  p(`
// ------------------------------------------
// Blade Squaring
`);

  const coords = "uvwxyz";
  const ctx = new EvalContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

  const blade =
    !true ? alg.wedgeProduct(
      alg.mv("v1", {x: 3, y: 5, z: 9, u: 1}),
      alg.mv("v2", {x: 1, y:-3, z: 7, v:13}),
      alg.mv("v3", {x: 2, y: 2, z:11, w:-3}),
    )
    : alg.mv("v", {wx: 4, xz: 7, yz:-5, uv: 3});

  p(`${blade} ** 2
= ${alg.geometricProduct(blade, blade)}`);
}
{
  p(`
// ------------------------------------------
// Blade Exponentiation - WebGL
`);

  const coords = "xyz";
  const ctx = new WebGLContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

  const blade = alg.wedgeProduct(
      alg.mv("v", {x: 3, y: 5, z: 9}),
      alg.mv("v", {x: 1, y:-3, z: 7}),
    );

  const result = alg.exp(blade);
  p(ctx.text);
  p(`// result: ${result}`)
}
{
  p(`
// ------------------------------------------
// Blade Exponentiation - Eval
`);

  const coords = "xyz";
  const ctx = new EvalContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

  const blade = alg.wedgeProduct(
    alg.mv("a", {x: 3, y: 5, z: 9}),
    alg.mv("b", {x: 1, y:-3, z: 7}),
  );

  p(`exp(${blade}) =
${alg.exp(blade)}`);
}
{
  p(`
// ------------------------------------------
// Rotor Log - WebGL
`);

  const coords = "xyz";
  const ctx = new WebGLContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

  const versor = alg.geometricProduct(
    alg.mv("v", {x: 3, y: 5, z: 9}),
    alg.mv("v", {x: 1, y:-3, z: 7}),
  );
  const rotor = alg.normalize(versor);

  const result = alg.log(rotor);
  p(ctx.text);
  p(`// result: ${result}`)
}
{
  p(`
// ------------------------------------------
// Rotor Log -  Eval
`);

  const coords = "xyz";
  const ctx = new EvalContext();
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

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
}
{
  p(`
// ------------------------------------------
// Slerp - WebGL + eval
`);

  const coords = "xyz";

  function slerpTest<T>(ctx: Context<T>) {
    const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

    const v1 = alg.mv("v1", {x: 1, y: 1});
    const v2 = alg.mv("v2", {x: 1, y: 1, z: 1});
    const slerpArc = alg.slerp(v1, v2);
    return slerpArc(.3);
  }

  const ctx = new WebGLContext();
  const result = slerpTest(ctx);
  p(ctx.text);
  p("// " + result);

  q_(coords)("\nresult", slerpTest(new EvalContext()));
}
{
  p(`
// ------------------------------------------
// Normalization - eval
`);

  const coords = "xyzw";
  const q = q_(coords);

  function test_normalize(m: number[]) {
    const alg = new Algebra(m, new EvalContext(), makeLetterNames(coords));

    const B1 = alg.mv("B1", {x: 5, y: 2, z: 3});
    const B2 = alg.mv("B2", {x: 2, y:-1, z: 2});
    const B3 = alg.mv("B3", {x:-1, y: 4, z:-1});

    p("-----------");
    q("normalize(one)", alg.normalize(alg.one()));
    q("normalize(ex)", alg.normalize(alg.basisVectors()[0]));
    q("normalize(B1)", alg.normalize(B1));
    q("normalize(B1^B2)", alg.normalize(alg.wedgeProduct(B1, B2)));
    q("normalize(B1 B2)", alg.normalize(alg.geometricProduct(B1, B2)));
    q("normalize(B1 B2 B3)", alg.normalize(alg.geometricProduct(B1, B2, B3)));
    p();
    p("// Normalization distributes over geometric products:");
    q("normalize(B1) normalize(B2) normalize(B3)",
      alg.geometricProduct(alg.normalize(B1), alg.normalize(B2), alg.normalize(B3))
    );
    q("normalize(B1) normalize(B2 B3)",
      alg.geometricProduct(alg.normalize(B1), alg.normalize(alg.geometricProduct(B2, B3)))
    );
    p("// But it does not distribute over wedge products:")
    q("normalize(B1)^normalize(B2)",
      alg.wedgeProduct(alg.normalize(B1), alg.normalize(B2))
    );
  }

  for (let m of [[1,1,1,1],[2,-3,4,1]]) {
    test_normalize(m);
  }
}
{
  p(`
// ------------------------------------------
// Outermorphism - WebGL and eval
`);

  const coords = "xyzw";
  const q = q_(coords);

  const coords2 = "pqr";
  const q2 = q_(coords2);

  function testOM<T>(ctx: Context<T>) {
    const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));
    const alg2 = new Algebra(euclidean(coords2), ctx, makeLetterNames(coords2));

    const m1 =  [
      /*         x   y    z     w */
      /* p */ [  10],
      /* q */ [  ,   100],
      /* r */ [  ,   ,    1000],
    ];
    const m2 =  [
      /*         x   y    z     w */
      /* p */ [  ,   ,    1000],
      /* q */ [  ,   100],
      /* r */ [  10],
    ];
    const m2a =  [
      /*         x   y    z     w */
      /* p */ [  10],
      /* q */ [  ,   ,    1000],
      /* r */ [  ,   100],
    ];
    const m3 =  [
      /*         x   y    z     w */
      /* p */ [  ,   10],
      /* q */ [  ,   100, .001],
      /* r */ [  .1, ,    1000],
    ];

    const A = alg.mv("A", {
      "1": 1111,
      x: 5, y: 2, z: 3,
      xz: 8, yz: 7, xw: 6666666,
      xyz: 9,
    });

    return alg2.outermorphism(A, m3);
  }

  const webCtx = new WebGLContext();
  const result = testOM(webCtx);
  console.log(webCtx.text);
  console.log(`// result: ${result}`);

  console.log("\n-------------\n")

  q2("result", testOM(new EvalContext()));
}
{
  p(`
// ------------------------------------------
// Determinants - eval
`);

  const ctx = new EvalContext();

  const coords = "xyz";
  const q = q_(coords);
  const alg = new Algebra([2,3,5], ctx, makeLetterNames(coords));

  const coords2 = "pqr";
  const q2 = q_(coords2);
  const alg2 = new Algebra([4, 5, 6], ctx, makeLetterNames(coords2));

  const m =  [
    /*         x   y    z */
    /* p */ [  ,   10],
    /* q */ [  ,   100, .001],
    /* r */ [  .1, ,    1000],
  ];

  const I = alg.pseudoScalar();
  q("I", I);
  q("|I|", alg.norm(I));

  const mI = alg2.outermorphism(I, m);
  q2("f_m(I)", mI);
  q2("|f_m(I)|", alg2.norm(mI));

  
  q("det(m)", mI.value(alg2.fullBitmap));
  // The determinant of the linear mapping f_m,
  // which also takes the metrics into account:
  q("det(f_m)", alg2.norm(mI) / alg.norm(I));

  // The definition of a determinant in [DFM09], p. 106, formula (4.7) assumes
  // an endomorphisms (co-domain === domain).  So the identical metrics of
  // domain and co-domain cancel each other out and thus the mapping determinant
  // coincides with the matrix determinant.
  q("det(endomorphism)", alg.norm(alg.outermorphism(I, m)) / alg.norm(I));
}
{
  p(`
// ------------------------------------------
// precalculate - WebGL
`);

  const ctx = new WebGLContext();

  const three = ctx.scalarOp("abs", ctx.scalarOp("-", 7, 10));
  ctx.emit(`// should be 3 (evaluated): ${three}`);

  p(ctx.text);
}
{
  p(`
// ------------------------------------------
// norm and normalization, special cases - WebGL
`);

  const ctx = new WebGLContext();
  const coords = "xyz";
  const alg = new Algebra([1,1,5], ctx, makeLetterNames(coords));

  ([
    {xy: 1},
    {xy: -7},
    {xy: "foo"},
    {xz: -2},
    {xz: "bar"},
    {x: 1, y: -2, z: 3},
    {x: 1, y: "two", z: 3},
  ] as Record<string, Factor<string>>[]).forEach((data, i) => {
    ctx.space();
    ctx.emit("// -----------");
    const mv = alg.mv(`mv${i}`, data);
    ctx.emit(`// ${mv}`)
    ctx.emit(`// norm: ` + alg.norm(mv));
    const normalized = alg.normalize(mv);
    ctx.emit(`// normalized: ` + normalized);
    ctx.emit(`// norm(normalized): ` + alg.norm(normalized));
    ctx.emit(`// norm(normalized) [computed]: ` + alg.norm(hideUnit(alg, normalized)));
  });

  p(ctx.text);
}
{
  p(`
// ------------------------------------------
// unitness and exp - eval
`);

  const ctx = new EvalContext();
  const coords = "xyzw";
  const alg = new Algebra([1,1,1,5], ctx, makeLetterNames(coords));
  const q = q_(coords);

  const B = alg.mv("B", {xy: .3, xz: .1, yz: .2});
  q("|B|", alg.norm(B));
  q("|B|", deg(alg.norm(B)));
  
  const exp = alg.exp(B);
  q("exp", exp);
  q("|exp|", alg.norm(exp));
  q("|exp| [computed]", alg.norm(hideUnit(alg, exp)));

  const EXW = alg.mv("exw", {xw: 1})
  const expEXW = alg.exp(EXW);
  q("exp(EXW)", expEXW);
  q("exp(EXW) w/o unit mark", hideUnit(alg, expEXW));
  q("|exp(EXW)|", alg.norm(expEXW));
  q("|exp(EXW)| [computed]", alg.norm(hideUnit(alg, expEXW)));
}
{
  p(`
// ------------------------------------------
// slerp - WebGL
`);

  const ctx = new WebGLContext();
  const coords = "xyz";
  const alg = new Algebra([1,1,5], ctx, makeLetterNames(coords));

  const a = alg.mv("a", {x: "a.x", y: "a.y"});
  const b = alg.mv("b", {x: "b.x"});
  // const a = alg.mv("a", {x: 1, y: 2});
  // const b = alg.mv("b", {x: 2, y: 4});
  const slerpAB = alg.slerp(a, b);

  ctx.emit(`----`);
  ctx.emit(`0: ${slerpAB(0)}`);
  ctx.emit(`----`);
  ctx.emit(`1/3: ${slerpAB(1/3)}`);
  ctx.emit(`----`);
  ctx.emit(`2/3: ${slerpAB(2/3)}`);
  ctx.emit(`----`);
  ctx.emit(`1: ${slerpAB(1)}`);
  ctx.emit(`----`);
  ctx.emit(`t: ${slerpAB("t")}`);

  p(ctx.text);
}
{
  p(`
// ------------------------------------------
// sandwich - WebGL
`);

  const ctx = new WebGLContext();
  const coords = "xyz";
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

  for (const create of [
    () => [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("b", {x: "bx", y: "by", z: "bz"})],
    () => [alg.mv("a", {x: 1   , y: 1   }), alg.mv("b", {x: 1   , y: 1   , z: 1   })],
  ]) {
    const [a, b] = create();
    ctx.emit(`// a: ${a}`);
    ctx.emit(`// b: ${b}`);
    const ba = alg.geometricProduct(b, a);
    ctx.emit(`// ba: ${ba}`);
    const rotor = alg.normalize(ba);
    ctx.emit(`// rotor: ${rotor}`);
    ctx.emit(`// rotor~: ${alg.reverse(rotor)}`);
    const sw_rotor = alg.sandwich(rotor);
    for (const c of [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("a", {x: 1, y: 1})]) {
      ctx.emit(`// c: ${c}`);
      ctx.emit(`// sandwich: ${sw_rotor(c)}`);
      ctx.emit(`// sandwich1: ${alg.sandwich1(rotor, c)}`);
    }
    // console.log(ctx.text); process.exit();
    const a0 = alg.normalize(a);
    const b0 = alg.normalize(b);

    for(const [name, value] of Object.entries({a, b, ba, rotor})) {
      ctx.emit(`\n// ${name}: ${value}`);
      ctx.emit(`// |${name}|**2: ${alg.normSquared(value)}`);
      ctx.emit(`// |${name}|**2: ${alg.sandwich(value)(alg.one())}`);  
    }
    ctx.emit("---------------------");
  }

  // Minimalistic example where the cancelling performed by `alg.sandwich(...)`
  // omits the zero-valued xyz component:
  for (const create of [
    () => [alg.mv("a", {x: Math.SQRT1_2, y: Math.SQRT1_2}).markAsUnit(), alg.mv("b", {z: 1}).markAsUnit()],
    () => [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("b", {z: "bz"})],
  ]) {
    let [a, b] = create();
    a = alg.normalize(a);
    b = alg.normalize(b);
    ctx.emit(`// a: ${a})`);
    ctx.emit(`// b: ${b})`);
    const sw_a = alg.sandwich(a);
    ctx.emit(`// sandwich/dummy: ${sw_a(alg.mv("dummy", {z: "1.0"}), {dummy: true})}`);
    ctx.emit(`// sandwich: ${sw_a(b)})`);
    ctx.emit(`// sandwich/neg: ${sw_a(alg.negate(b))})`);
    ctx.emit(`// sandwich1: ${alg.sandwich1(a, b)})`);
    ctx.emit("---------------------");
  }

  p(ctx.text);
}
{
  console.log(`
// ------------------------------------------
// Homogeneous - WebGL
// [DFM09] p. 275, equation (11.1)
`);

  const ctx = new WebGLContext();
  const coords = "xyzw";
  const alg = new Algebra([1,1,1,-1], ctx, makeLetterNames(coords));

  const [ex, ey, ez, ew] = alg.basisVectors();
  const ew_inv = alg.inverse(ew);
  ctx.emit(`// ew_inv: ${ew_inv}`);
  const p = alg.mv("p", {x: "px", y: "py", z: "pz", w: "pw"});
  ctx.emit(`// weight w: ${alg.contractLeft(ew_inv, p)}`);
  ctx.emit(`// location: ${
    alg.geometricProduct(
      alg.contractLeft(ew_inv, alg.wedgeProduct(ew, p)),
      alg.inverse(alg.contractLeft(ew_inv, p)),
    )
  }`);


  console.log(ctx.text);
}
{
  console.log(`
// ------------------------------------------
// Inverse Check
`);

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
}
{
  console.log(`
// ------------------------------------------
// WASM generation
`);

  const mod = new binaryen.Module();
  mod.setFeatures(binaryen.Features.Multivalue);

  const ctx = new WASMContext(mod,
    "h.1 h.xy h.xz h.yz e.x e.w" // d.z
    .split(" ")
  );
  const coords = "xyzw";
  const alg = new Algebra([1,333,1,-1], ctx, makeLetterNames(coords));

  const param = ctx.paramsByHint;
  const h = alg.mv("h", {
    1: param["h.1"], xy: param["h.xy"], xz: param["h.xz"], yz: param["h.yz"]
  });
  const inputs = [
    // alg.mv("d", {x: 2.22, z: param["d.z"], w: 4.44}),
    alg.mv("e", {x: param["e.x"], w: param["e.w"]}),
  ];

  const sandwich_h = alg.sandwich(h);
  const invNorm = ctx.scalarOp("/", 1, sandwich_h(alg.one()).value(0));
  const results = inputs.map(inp => alg.scale(invNorm, sandwich_h(inp)));
  // TODO make use of the bitmaps in result
  ctx.body.push(
    mod.return(mod.tuple.make(
      results.flatMap(res => [...res].map(([,val]) => ctx.convertFactor(val)))
    ))
  );

  const f64Array = (length: number): binaryen.Type[] => new Array(length).fill(binaryen.f64);

  const fn = mod.addFunction(
    "myTest",
    binaryen.createType(f64Array(ctx.paramCount)),
    binaryen.createType(f64Array(results.flatMap(res => [...res]).length)),
    f64Array(ctx.varCount - ctx.paramCount),
    mod.block(null, ctx.body),
  );
  mod.addFunctionExport("myTest", "myTestExt");
  p(`// valid: ${Boolean(mod.validate())}`);
  // TODO instead of .optimize(), add the needed passes to .runPasses([...])
  // (Some passes of .optimize() are apparently undone by my subsequent
  // passes.  So we should not run them in the first place.)
  mod.optimize();
  // Make the output more readable:
  mod.runPasses([
    // See https://github.com/WebAssembly/binaryen/blob/main/src/passes/pass.cpp
    // for available passes.
    "flatten",
    "simplify-locals-notee",
    "ssa",
    // running the last two paths again produces nicer code (in some cases):
    "simplify-locals-notee",
    "ssa",
    "vacuum", // removes `(nop)`s, but not unused variables
    "coalesce-locals", // removes most unused variables
  ]);

  writeAndStat("./out.wst", mod.emitText());
  const binary = mod.emitBinary();
  writeAndStat("./out.wasm", binary);

  {
    const {name, params, body} = binaryen.getFunctionInfo(fn);
    const paramTypes = binaryen.expandType(params)
    const header = `function ${name}(${
      ctx.paramHints.map((hint, i) => `\n  float v${i} /* ${hint} */`).join(",")
    }\n  // ${
      paramTypes.length
    }${
      paramTypes.length === ctx.paramCount ? "" :
      " [### param number mismatch ###]"
    }\n) : [${
      results.flatMap((res, i) => [...res].map(([bm]) => `\n  float /* out[${i}].${alg.bitmapToString[bm]} */`).join(","))
    }\n]`;
    const prettyLines: string[] = [header];
    prettyStmt(body, line => prettyLines.push(line));
    const pretty = prettyLines.join("\n");
    writeAndStat("./out.mylang", pretty);
    p();
    p(pretty);
  }

  function writeAndStat(where: string, what: string | Uint8Array) {
    fs.writeFileSync(where, what);
    p(`// ${where}: ${what.length} (brotli ${zlib.brotliCompressSync(what).length})`);
  }

  function prettyStmt(stmt: binaryen.ExpressionRef, emit: (line: string) => unknown): void {
    const stmtInfo = binaryen.getExpressionInfo(stmt);
    switch (stmtInfo.id) {
      case binaryen.NopId: {
        break;
      }
      case binaryen.LocalSetId: {
        const {isTee, index, value} = stmtInfo as binaryen.LocalSetInfo;
        if (isTee) emit("### tee not supported");
        // This assumes single-assignment form:
        indent(`float v${index} = ${prettyExpr(value)};`, emit)
        break;
      }
      case binaryen.ReturnId:
        const {value} = stmtInfo as binaryen.ReturnInfo;
        indent(`return ${prettyExpr(value)};`, emit);
        break;
      case binaryen.BlockId: {
        const {children} = stmtInfo as binaryen.BlockInfo;
        emit("{");
        for (const child of children) {
          prettyStmt(child, line => emit("  " + line));
        }
        emit("}");
        break;
      }
      case binaryen.UnreachableId: {
        emit("// unreachable");
        break;
      }
      default: {
        emit("### statement " + stmtInfo.id);
        break;
      }
    }
  }

  function indent(text: string, emit: (line: string) => unknown): void {
    text.split("\n").forEach(emit);
  }

  function prettyExpr(expr: binaryen.ExpressionRef): string {
    const exprInfo = binaryen.getExpressionInfo(expr);
    switch(exprInfo.id) {
      case binaryen.ConstId: {
        const {value} = exprInfo as binaryen.ConstInfo;
        return `${value}`;
      }
      case binaryen.LocalGetId: {
        const {index} = exprInfo as binaryen.LocalGetInfo;
        return `v${index}`;
      }
      case binaryen.UnaryId: {
        const {op, value} = exprInfo as binaryen.UnaryInfo;
        switch (op) {
          case binaryen.NegFloat64: return `(-${prettyExpr(value)})`;
          default: return "### unary " + op;
        }
      }
      case binaryen.BinaryId: {
        const {op, left, right} = exprInfo as binaryen.BinaryInfo;
        const opString =
          op === binaryen.AddFloat64 ? "+" :
          op === binaryen.SubFloat64 ? "-" :
          op === binaryen.MulFloat64 ? "*" :
          op === binaryen.DivFloat64 ? "/" :
          "### binop " + op;
        return `(${prettyExpr(left)} ${opString} ${prettyExpr(right)})`;
      }
      case binaryen.TupleMakeId: {
        const {operands} = exprInfo as binaryen.TupleMakeInfo;
        // TODO properly indent line breaks within elem output
        return `[\n   ${operands.map(elem => prettyExpr(elem)).join(",\n   ")}\n]`;
      }

      default: return "### expr " + exprInfo.id;
    }
  }
}
