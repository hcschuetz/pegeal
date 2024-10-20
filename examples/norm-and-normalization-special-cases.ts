import { Algebra, Scalar } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { p, q_ } from "./utils";

p(`norm and normalization, special cases - WebGL\n`);

const coords = "xyz";
const be = new WebGLBackEnd();
const alg = new Algebra([1,1,5], be, makeLetterNames(coords));

// output helpers
const c = (text: string) => be.emit("// " + text);
const q = q_(coords, c);

([
  {xy: 1},
  {xy: -7},
  {xy: "foo"},
  {xz: -2},
  {xz: "bar"},
  {x: 1, y: -2, z: 3},
  {x: 1, y: "two", z: 3},
] as Record<string, Scalar<string>>[]).forEach((data, i) => {
  c("");
  c("-----------");
  const mv = alg.mv(data);
  q("mv", mv)
  q(`norm`, alg.norm(mv));
  const normalized = alg.normalize(mv);
  q(`normalized`, normalized);
  q(`norm(normalized)`, alg.norm(normalized));
  normalized.withSqNorm(undefined);
  q(`norm(normalized) [computed]`, alg.norm(normalized));
});

p(be.text);
