import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLContext } from "../src/generateWebGL";
import { euclidean, p } from "./utils";

p(`// Rotor Log - WebGL\n`);

const coords = "xyz";
const ctx = new WebGLContext();
const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

const versor = alg.geometricProduct(
  alg.mv("v", {x: 3, y: 5, z: 9}),
  alg.mv("v", {x: 1, y:-3, z: 7}),
);
const rotor = alg.normalize(versor);

const result = alg.log(rotor);
p(ctx.text);
p(`// result: ${result}`)
