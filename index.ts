import { Algebra } from "./Algebra";
import { WebGLContext } from "./generateWebGL";

const ctx = new WebGLContext(["x", "y", "z", "w"]);
const alg = new Algebra([1, 2.222, 3.3, 0], ctx);

// -----------------------------------------------------------------------------
// Usage Examples

const zero = alg.zero(), one = alg.one();
const [ex, ey, ez] = alg.basisVectors();
const I = alg.pseudoScalar();
const Iinv = alg.pseudoScalarInv();
const Iinv2 = alg.pseudoScalarInv();
ctx.emit("// " + (Iinv === Iinv2 ? "identical" : "not identical"));

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
alg.dual(mv);
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
alg.scalarProduct(mv3, mv3);
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

console.log("Generated Code:\n" + ctx.text);

/*
TODO support control structures.
In particular we need to support variable assignment
so that the same variable can be assigned in different paths
and the value is usable after the paths have joined.
(After the join the variable has the union of the components from each path.
components missing in a path must be set to 0.0 explicitly in that path.)
*/
