import { Algebra, Scalar } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLContext } from "../src/generateWebGL";
import { hideUnit, p } from "./utils";

p(`// norm and normalization, special cases - WebGL\n`);

const ctx = new WebGLContext();
const coords = "xyz";
const alg = new Algebra([1,1,5], ctx, makeLetterNames(coords));

([
  {xy: 1},
  {xy: -7},
  {xy: "foo"},
  {xz: -2},
  {xz: "bar"},
  {x: 1, y: -2, z: 3},
  {x: 1, y: "two", z: 3},
] as Record<string, Scalar<string>>[]).forEach((data, i) => {
  ctx.space();
  ctx.emit("// -----------");
  const mv = alg.mv(`mv${i}`, data);
  ctx.emit(`// ${mv}`)
  ctx.emit(`// norm: ` + alg.norm(mv));
  const normalized = alg.normalize(mv);
  ctx.emit(`// normalized: ` + normalized);
  ctx.emit(`// norm(normalized): ` + alg.norm(normalized));
  ctx.emit(`// norm(normalized) [computed]: ` + alg.norm(hideUnit(alg, normalized)));
});

p(ctx.text);
