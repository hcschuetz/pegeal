import { Algebra } from "../src/Algebra";
import { makeNumberedNames } from "../src/componentNaming";
import NumericBackEnd from "../src/NumericBackEnd";
import { p } from "./utils";
import { euclidean } from "../src/euclidean";

{
  p(`// Component names like "e013"\n`);

  const metric = euclidean(4);
  const be = new NumericBackEnd();
  const alg = new Algebra(metric, be, makeNumberedNames(metric.length));

  const m = alg.mv("m", {1: 7, e01: 3, e23: 5});
  p("m: " + m);
  p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}

{
  p(`// Component names like "e1_8_11"\n`);

  const metric = euclidean(13);
  const be = new NumericBackEnd();
  const alg = new Algebra(
    metric,
    be,
    makeNumberedNames(metric.length, {scalar: "scalar", start: 1})
  );

  const m = alg.mv("m", {scalar: 7, e1_11: 3, e2_13: 5});
  p("m: " + m);
  p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
}
