import { Algebra } from "./Algebra";
import { Context, AlgebraImpl } from "./WebGLAlgebra";

// -----------------------------------------------------------------------------
// Setting up the algebra

class ContextImpl implements Context {
  count = 0;
  text = "";

  uniqueIdentifier(base: string) {
    return `${base}_${this.count++}`;
  }
  emit(newText: string) {
    this.text += newText + "\n";
  }
}

const ctx = new ContextImpl();

const coordNames = ["x", "y", "z"];
function mkCoord(bm: number) {
  if (bm === 0) return "1";
  let coord = "";
  for (let i = 0; i < coordNames.length; i++) {
    if (bm & (1 << i)) {
      coord += coordNames[i];
    }
  }
  return coord;
}

const alg: Algebra = new AlgebraImpl(ctx, coordNames.length, mkCoord);

// -----------------------------------------------------------------------------
// Usage Examples

const zero = alg.zero(), one = alg.one();
const [ex, ey, ez] = alg.basis();
const I = alg.pseudoScalar();
const Iinv = alg.pseudoScalarInv();
const Iinv2 = alg.pseudoScalarInv();
ctx.emit("// " + (Iinv === Iinv2 ? "identical" : "not identical"));

ctx.emit("\n// ---------------");
const mv =
  true
  ? alg.mv({
      "1": "foo_scalar",
      x: "foo_x", y: "foo_y", z: "foo_z",
      xy: "foo_xy", xz: "foo_xz", yz: "foo_x",
      xyz: "foo_xyz",
    })
  : alg.mv({1: "S", x: "X", yz: "YZ", xyz: "PS"});

alg.gradeInvolution(mv);
alg.reverse(mv);
alg.dual(mv);
for (let i = 0; i <= alg.dimension; i++) {
  alg.extractGrade(i, mv);
}

const result =
  alg.contract(
    alg.wedge(ey, one),
    alg.wedge(
      alg.plus(alg.scale("2.0", ex), ey, I, zero, alg.plus()),
      alg.negate(alg.mv({y: "1.0", x: "4.0", z: "3.0"})),
      alg.wedge(),
    )
  );

ctx.emit(`\n// result: ${result}`);

ctx.emit("\n// (ex ^ ez) _| mv")
alg.contract(alg.wedge(ex, ez), mv);
ctx.emit("\n// ex _| (ez _| mv)")
alg.contract(ex, alg.contract(ez, mv));

const X = 1, Y = 2, Z = 4;
ctx.emit(`\n// extracted: ${mv.get(X|Y)}, ${mv.get("xy")}`);

const mv2 = alg.mv({x: "3", z: "2"});
const mv3 = alg.mv({xy: "3", xz: "2"});

ctx.emit(`\n// contractions`);
alg.contract(mv2, mv2);
alg.contract(mv3, mv3);
alg.contract(mv2, mv3);

ctx.emit(`\n// scalarProd`);
alg.scalarProd(mv2, mv2);
alg.scalarProd(mv3, mv3);
ctx.emit(`\n// empty: ${alg.scalarProd(mv2, mv3)}`);

ctx.emit(`\n// geomProd`);
alg.geomProd(mv2, mv2);
alg.geomProd(mv3, mv3);
ctx.emit(`\n// empty: ${alg.geomProd(mv2, mv3)}`);

ctx.emit(`\n// wedge`);
alg.wedge(mv2, mv2);
alg.wedge(mv3, mv3);
ctx.emit(`\n// empty: ${alg.wedge(mv2, mv3)}`);

console.log("Generated Code:\n" + ctx.text);

/*
TODO support control structures.
In particular we need to support variable assignment
so that the same variable can be assigned in different paths
and the value is usable after the paths have joined.
(After the join the variable has the union of the components from each path.
components missing in a path must be set to 0.0 explicitly in that path.)
*/
