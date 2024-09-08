import { Algebra } from "../src/Algebra";
import { makeNumberedNames } from "../src/componentNaming";
import { EvalContext } from "../src/evalExpr";
import { euclidean, p } from "./utils";

p(`// A context using component names like "e013"\n`);

const metric = euclidean(4);
const ctx = new EvalContext();
const alg = new Algebra(metric, ctx, makeNumberedNames(metric.length));

const m = alg.mv("m", {1: 7, e01: 3, e23: 5});
p("m: " + m);
p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
