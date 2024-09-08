import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLContext } from "../src/generateWebGL";
import { p } from "./utils";

p(`// slerp - WebGL\n`);

const ctx = new WebGLContext();
const coords = "xyz";
const alg = new Algebra([1,1,5], ctx, makeLetterNames(coords));

const a = alg.mv("a", {x: "a.x", y: "a.y"});
const b = alg.mv("b", {x: "b.x"});
// const a = alg.mv("a", {x: 1, y: 2});
// const b = alg.mv("b", {x: 2, y: 4});
const slerpAB = alg.slerp(a, b);

ctx.emit(`----`);
ctx.emit(`0: ${slerpAB(0)}`);
ctx.emit(`----`);
ctx.emit(`1/3: ${slerpAB(1/3)}`);
ctx.emit(`----`);
ctx.emit(`2/3: ${slerpAB(2/3)}`);
ctx.emit(`----`);
ctx.emit(`1: ${slerpAB(1)}`);
ctx.emit(`----`);
ctx.emit(`t: ${slerpAB("t")}`);

p(ctx.text);
