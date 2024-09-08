import { Algebra } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { WebGLContext } from "../generateWebGL";
import { euclidean, p } from "./utils";

p(`// sandwich - WebGL\n`);

const ctx = new WebGLContext();
const coords = "xyz";
const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

for (const create of [
  () => [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("b", {x: "bx", y: "by", z: "bz"})],
  () => [alg.mv("a", {x: 1   , y: 1   }), alg.mv("b", {x: 1   , y: 1   , z: 1   })],
]) {
  const [a, b] = create();
  ctx.emit(`// a: ${a}`);
  ctx.emit(`// b: ${b}`);
  const ba = alg.geometricProduct(b, a);
  ctx.emit(`// ba: ${ba}`);
  const rotor = alg.normalize(ba);
  ctx.emit(`// rotor: ${rotor}`);
  ctx.emit(`// rotor~: ${alg.reverse(rotor)}`);
  const sw_rotor = alg.sandwich(rotor);
  for (const c of [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("a", {x: 1, y: 1})]) {
    ctx.emit(`// c: ${c}`);
    ctx.emit(`// sandwich: ${sw_rotor(c)}`);
    ctx.emit(`// sandwich1: ${alg.sandwich1(rotor, c)}`);
  }
  // console.log(ctx.text); process.exit();
  const a0 = alg.normalize(a);
  const b0 = alg.normalize(b);

  for(const [name, value] of Object.entries({a, b, ba, rotor})) {
    ctx.emit(`\n// ${name}: ${value}`);
    ctx.emit(`// |${name}|**2: ${alg.normSquared(value)}`);
    ctx.emit(`// |${name}|**2: ${alg.sandwich(value)(alg.one())}`);  
  }
  ctx.emit("---------------------");
}

// Minimalistic example where the cancelling performed by `alg.sandwich(...)`
// omits the zero-valued xyz component:
for (const create of [
  () => [alg.mv("a", {x: Math.SQRT1_2, y: Math.SQRT1_2}).markAsUnit(), alg.mv("b", {z: 1}).markAsUnit()],
  () => [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("b", {z: "bz"})],
]) {
  let [a, b] = create();
  a = alg.normalize(a);
  b = alg.normalize(b);
  ctx.emit(`// a: ${a})`);
  ctx.emit(`// b: ${b})`);
  const sw_a = alg.sandwich(a);
  ctx.emit(`// sandwich/dummy: ${sw_a(alg.mv("dummy", {z: "1.0"}), {dummy: true})}`);
  ctx.emit(`// sandwich: ${sw_a(b)})`);
  ctx.emit(`// sandwich/neg: ${sw_a(alg.negate(b))})`);
  ctx.emit(`// sandwich1: ${alg.sandwich1(a, b)})`);
  ctx.emit("---------------------");
}

p(ctx.text);
