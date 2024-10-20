import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { p } from "./utils";

const be = new WebGLBackEnd();
const alg = new Algebra([1, 2.222, 3, 0], be, makeLetterNames("xyzw"));

const zero = alg.zero(), one = alg.one();
const [ex, ey, ez] = alg.basisVectors();
const I = alg.pseudoScalar();

// This does not work with a null vector in the basis:
// const Iinv = alg.pseudoScalarInv();
// const Iinv2 = alg.pseudoScalarInv();
// be.emit("// " + (Iinv === Iinv2 ? "identical" : "not identical"));

be.emit("\n// ---------------");
const mv =
  true
  ? alg.mv({
      "1": "foo_scalar",
      x: "foo_x", y: "foo_y", z: "foo_z",
      xy: "foo_xy", xz: "foo_xz", yz: "foo_yx",
      xyz: "foo_xyz",
    })
  : alg.mv({1: "S", x: "X", yz: "YZ", xyz: "PS"});

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
      alg.plus(
        alg.scale("2.0", ex),
        alg.minus(ex, ey),
        I, zero, alg.plus()),
      alg.negate(alg.vec(["4.0", "1.0", "3.0", 0])),
      alg.wedgeProduct(),
    )
  );

be.emit(`\n// result: ${result}`);

be.emit("\n// (ex ^ ez) _| mv")
alg.contractLeft(alg.wedgeProduct(ex, ez), mv);
be.emit("\n// ex _| (ez _| mv)")
alg.contractLeft(ex, alg.contractLeft(ez, mv));

const X = 1, Y = 2, Z = 4;
be.emit(`\n// extracted: ${mv.value(X|Y)}`);

const mv2 = alg.mv({x: "3", z: "2"});
const mv3 = alg.mv({xy: "3", xz: "2", zw: "8"});

be.emit(`\n// contractLeft`);
alg.contractLeft(mv2, mv2);
alg.contractLeft(mv3, mv3);
alg.contractLeft(mv2, mv3);
alg.contractLeft(mv3, mv2);

be.emit(`\n// contractRight`);
alg.contractRight(mv2, mv2);
alg.contractRight(mv3, mv3);
alg.contractRight(mv2, mv3);
alg.contractRight(mv3, mv2);

be.emit(`\n// scalarProd`);
alg.scalarProduct(mv2, mv2);
alg.scalarProductMV(mv2, mv2);
alg.scalarProduct(mv3, mv3);
alg.scalarProductMV(mv3, mv3);
be.emit(`\n// empty: ${alg.scalarProduct(mv2, mv3)}`);

be.emit(`\n// dotProd`);
alg.dotProduct(mv2, mv2);
alg.dotProduct(mv3, mv3);
be.emit(`\n// empty: ${alg.dotProduct(mv2, mv3)}`);

be.emit(`\n// geomProd`);
alg.geometricProduct(mv2, mv2);
alg.geometricProduct(mv3, mv3);
be.emit(`\n// ${alg.geometricProduct(mv2, mv3)}`);

be.emit(`\n// wedge`);
alg.wedgeProduct(mv2, mv2);
alg.wedgeProduct(mv3, mv3);
be.emit(`\n// ${alg.wedgeProduct(mv2, mv3)}`);

be.emit(`\n// norm, inverse (mv2):`);
alg.scalarProduct(mv2, alg.reverse(mv2));
alg.inverse(mv2);
be.emit(`\n// norm, inverse (mv3):`);
alg.scalarProduct(mv3, alg.reverse(mv3));
alg.inverse(mv3);

p("Generated Code:\n" + be.text);

/*
TODO support control structures.
In particular we need to support variable assignment
so that the same variable can be assigned in different paths
and the value is usable after the paths have joined.
(After the join the variable has the union of the components from each path.
components missing in a path must be set to 0.0 explicitly in that path.)
*/
