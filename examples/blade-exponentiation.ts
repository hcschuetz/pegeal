import { Algebra } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { WebGLContext } from "../generateWebGL";
import { euclidean, p } from "./utils";

p(`// Blade Exponentiation - WebGL\n`);

const coords = "xyz";
const ctx = new WebGLContext();
const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

const blade = alg.wedgeProduct(
    alg.mv("v", {x: 3, y: 5, z: 9}),
    alg.mv("v", {x: 1, y:-3, z: 7}),
  );

const result = alg.exp(blade);
p(ctx.text);
p(`// result: ${result}`)