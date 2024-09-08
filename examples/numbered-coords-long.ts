import { Algebra } from "../Algebra";
import { makeNumberedNames } from "../componentNaming";
import { EvalContext } from "../evalExpr";
import { euclidean, p } from "./utils";

p(`// A context using component names like "e1_8_11"\n`);

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
