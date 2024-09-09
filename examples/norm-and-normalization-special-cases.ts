import { Algebra, Scalar } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLBackEnd } from "../src/generateWebGL";
import { hideUnit, p } from "./utils";

p(`// norm and normalization, special cases - WebGL\n`);

const be = new WebGLBackEnd();
const coords = "xyz";
const alg = new Algebra([1,1,5], be, makeLetterNames(coords));

([
  {xy: 1},
  {xy: -7},
  {xy: "foo"},
  {xz: -2},
  {xz: "bar"},
  {x: 1, y: -2, z: 3},
  {x: 1, y: "two", z: 3},
] as Record<string, Scalar<string>>[]).forEach((data, i) => {
  be.emit("");
  be.emit("// -----------");
  const mv = alg.mv(`mv${i}`, data);
  be.emit(`// ${mv}`)
  be.emit(`// norm: ` + alg.norm(mv));
  const normalized = alg.normalize(mv);
  be.emit(`// normalized: ` + normalized);
  be.emit(`// norm(normalized): ` + alg.norm(normalized));
  be.emit(`// norm(normalized) [computed]: ` + alg.norm(hideUnit(alg, normalized)));
});

p(be.text);
