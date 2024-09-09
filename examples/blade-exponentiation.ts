import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { euclidean, p } from "./utils";

p(`// Blade Exponentiation - WebGL\n`);

const coords = "xyz";
const be = new WebGLBackEnd();
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

const blade = alg.wedgeProduct(
    alg.mv("v", {x: 3, y: 5, z: 9}),
    alg.mv("v", {x: 1, y:-3, z: 7}),
  );

const result = alg.exp(blade);
p(be.text);
p(`// result: ${result}`)