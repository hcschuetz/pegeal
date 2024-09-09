import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLBackEnd } from "../src/generateWebGL";
import { p } from "./utils";

p(`// slerp - WebGL\n`);

const be = new WebGLBackEnd();
const coords = "xyz";
const alg = new Algebra([1,1,5], be, makeLetterNames(coords));

const a = alg.mv("a", {x: "a.x", y: "a.y"});
const b = alg.mv("b", {x: "b.x"});
// const a = alg.mv("a", {x: 1, y: 2});
// const b = alg.mv("b", {x: 2, y: 4});
const slerpAB = alg.slerp(a, b);

be.emit(`----`);
be.emit(`0: ${slerpAB(0)}`);
be.emit(`----`);
be.emit(`1/3: ${slerpAB(1/3)}`);
be.emit(`----`);
be.emit(`2/3: ${slerpAB(2/3)}`);
be.emit(`----`);
be.emit(`1: ${slerpAB(1)}`);
be.emit(`----`);
be.emit(`t: ${slerpAB("t")}`);

p(be.text);
