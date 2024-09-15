import { Algebra, BackEnd } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { euclidean, p, q_ } from "./utils";

p(`// Multi-back-end example\n`);

// This example is not about its geometry.
// It rather shows that the same geometric code can be used with
// multiple back ends.


const coords = "xyz";

function slerpTest<T>(be: BackEnd<T>) {
  const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

  const v1 = alg.mv("v1", {x: 1, y: 1});
  const v2 = alg.mv("v2", {x: 1, y: 1, z: 1});
  const slerpArc = alg.slerp(v1, v2);
  return slerpArc(.3);
}

const be = new WebGLBackEnd();
const result = slerpTest(be);
p(be.text);
p("// " + result);

// TODO also use `slerpTest` with WASM.

q_(coords)("\nresult", slerpTest(new DummyBackEnd()));
