import binaryen from "binaryen";
import { Algebra, BackEnd, Scalar } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import NumericBackEnd from "../src/NumericBackEnd";
import WASMBackEnd from "../src/WASMBackEnd";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { p, q_ } from "./utils";
import { euclidean } from "../src/euclidean";

p(`// Multi-back-end example\n`);

// This example is not about its geometry.
// It rather shows that the same geometric code can be used with
// multiple back ends.

const coords = "xyz";

function slerpTest<T>(
  be: BackEnd<T>,
  metric: Scalar<T>[],
  v1Components: Scalar<T>[],
  v2Components: Scalar<T>[],
) {
  const alg = new Algebra(metric, be, makeLetterNames(coords));

  const v1 = alg.vec(v1Components);
  const v2 = alg.vec(v2Components);
  const slerpArc = alg.slerp(v1, v2);
  return slerpArc(.3);
}

{
  const be = new WebGLBackEnd();
  be.comment("slerpTest: " + slerpTest(
    be,
    // Mixed symbolic and numeric input:
    [1, 1, "metricZ"],
    ["myX", 2, 0],
    [1, "myY", 4],
  ));
  p(be.text);
}

{
  const f64List = (size: number) => new Array(size).fill(binaryen.f64);
  const f64Tuple = (size: number) => binaryen.createType(f64List(size));

  // TODO provide more utilities to simplify this user-side code

  const mod = new binaryen.Module();
  mod.setFeatures(binaryen.Features.Multivalue);

  for (const [name, arity] of [
    ["max", 2],
    ["sqrt", 1],
    ["sin", 1],
    ["atan2", 2],
  ] as [string, number][]) {
    mod.addFunctionImport(name, name, "Math", f64Tuple(arity), binaryen.f64);
  }

  const be = new WASMBackEnd(mod, ["myX", "myY", "metricZ"]);
  const {myX, myY, metricZ} = be.paramsByHint;
  const result = slerpTest(
    be,
    [  1,   1, metricZ],
    [myX,   2,       0],
    [  1, myY,       4],
  );

  be.body.push(
    mod.return(mod.tuple.make(
      [...result].map(([,val]) => be.convertScalar(val))
    ))
  );
  
  const fn = mod.addFunction(
    "myTest",
    f64Tuple(be.paramCount),
    f64Tuple([...result].length),
    f64List(be.varCount - be.paramCount),
    mod.block(null, be.body),
  );
  mod.addFunctionExport("myTest", "myTestExt");
  p(`// valid: ${Boolean(mod.validate())}`);
    
  mod.optimize();
  mod.runPasses([
    "flatten",
    "simplify-locals-notee",
    "vacuum",
    "coalesce-locals",
    "ssa",
  ]);

  console.log(mod.emitText());
}

q_(coords)("\nresult", slerpTest(
  new NumericBackEnd(),
  euclidean(coords),
  [1, 2, 0],
  [1, 1, 4],
));
