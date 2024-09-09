import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLBackEnd } from "../src/generateWebGL";
import { euclidean, p } from "./utils";

p(`// Rotor Log - WebGL\n`);

const coords = "xyz";
const be = new WebGLBackEnd();
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

const versor = alg.geometricProduct(
  alg.mv("v", {x: 3, y: 5, z: 9}),
  alg.mv("v", {x: 1, y:-3, z: 7}),
);
const rotor = alg.normalize(versor);

const result = alg.log(rotor);
p(be.text);
p(`// result: ${result}`)
