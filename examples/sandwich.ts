import { Algebra, Multivector } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { p } from "./utils";
import { euclidean } from "../src/euclidean";

p(`// sandwich - WebGL\n`);

const be = new WebGLBackEnd();
const coords = "xyz";
const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));

const sandwichReference = (p: Multivector<string>, q: Multivector<string>) =>
  alg.geometricProduct(alg.geometricProduct(p, q), alg.reverse(p));

for (const create of [
  () => [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("b", {x: "bx", y: "by", z: "bz"})],
  () => [alg.mv("a", {x: 1   , y: 1   }), alg.mv("b", {x: 1   , y: 1   , z: 1   })],
]) {
  const [a, b] = create();
  be.emit(`// a: ${a}`);
  be.emit(`// b: ${b}`);
  const ba = alg.geometricProduct(b, a);
  be.emit(`// ba: ${ba}`);
  const rotor = alg.normalize(ba);
  be.emit(`// rotor: ${rotor}`);
  be.emit(`// rotor~: ${alg.reverse(rotor)}`);
  const sw_rotor = alg.sandwich(rotor, ["x", "y"]);
  for (const c of [alg.mv("a", {x: "ax", y: "ay"}), alg.mv("a", {x: 1, y: 1})]) {
    be.emit(`// c: ${c}`);
    be.emit(`// sandwich: ${sw_rotor(c)}`);
    be.emit(`// sandwich1: ${sandwichReference(rotor, c)}`);
  }
  const a0 = alg.normalize(a);
  const b0 = alg.normalize(b);

  for(const [name, value] of Object.entries({a, b, ba, rotor})) {
    be.emit(`\n// ${name}: ${value}`);
    be.emit(`// |${name}|**2: ${alg.normSquared(value)}`);
    be.emit(`// |${name}|**2: ${alg.sandwich(value, ["1"])(alg.one())}`);  
  }
  be.emit("---------------------");
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
  be.emit(`// a: ${a})`);
  be.emit(`// b: ${b})`);
  const sw_a = alg.sandwich(a, ["z"]);
  be.emit(`// sandwich: ${sw_a(b)})`);
  be.emit(`// sandwich/neg: ${sw_a(alg.negate(b))})`);
  be.emit(`// sandwich1: ${sandwichReference(a, b)})`);
  be.emit("---------------------");
}

p(be.text);
