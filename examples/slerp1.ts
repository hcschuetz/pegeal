import { Algebra, BackEnd } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { DummyBackEnd } from "../src/evalExpr";
import { WebGLBackEnd } from "../src/generateWebGL";
import { euclidean, p, q_ } from "./utils";

p(`// Slerp - WebGL + eval\n`);

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

q_(coords)("\nresult", slerpTest(new DummyBackEnd()));
