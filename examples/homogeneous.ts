import { Algebra } from "../Algebra";
import { makeNumberedNames } from "../componentNaming";
import { WebGLContext } from "../generateWebGL";
import { euclidean, p } from "./utils";

p(`// Homogeneous coords\n`);

const metric = euclidean(4);
const ctx = new WebGLContext();
const alg = new Algebra(metric, ctx, makeNumberedNames(metric.length));
const [e0, e1, e2, e3] = alg.basisVectors();
const e0Inv = alg.inverse(e0);

const point = alg.mv("point", {e0: "3", e1: "6", e2: "9", e3: "+++"});

// With our optimizations (and the expected optimizations by the WebGL
// compiler) the extractions of weight and location should be as efficient
// as in hand-written code:
const p_weight = alg.contractLeft(e0Inv, point);
const p_loc = alg.geometricProduct(
  alg.contractLeft(e0Inv, alg.wedgeProduct(e0, point)),
  alg.inverse(p_weight),
);

p(ctx.text)
