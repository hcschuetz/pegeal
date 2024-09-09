import { Algebra } from "../src/Algebra";
import { makeNumberedNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { euclidean, p } from "./utils";

p(`// A back-end using component names like "e013"\n`);

const metric = euclidean(4);
const be = new DummyBackEnd();
const alg = new Algebra(metric, be, makeNumberedNames(metric.length));

const m = alg.mv("m", {1: 7, e01: 3, e23: 5});
p("m: " + m);
p("mm~: " + alg.geometricProduct(m, alg.reverse(m)));
