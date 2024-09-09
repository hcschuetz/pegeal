import { Algebra } from "../src/Algebra";
import { makeNumberedNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { euclidean, p } from "./utils";

p(`// A back-end using component names like "e1_8_11"\n`);

const metric = euclidean(13);
const be = new DummyBackEnd();
const alg = new Algebra(
  metric,
  be,
  makeNumberedNames(metric.length, {scalar: "scalar", start: 1})
);

const m = alg.mv("m", {scalar: 7, e1_11: 3, e2_13: 5});
p("m: " + m);
p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
