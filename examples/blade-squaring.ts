import { Algebra } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { EvalContext } from "../evalExpr";
import { euclidean, p } from "./utils";

p(`// Blade Squaring\n`);

const coords = "uvwxyz";
const ctx = new EvalContext();
const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));

const blade =
  !true ? alg.wedgeProduct(
    alg.mv("v1", {x: 3, y: 5, z: 9, u: 1}),
    alg.mv("v2", {x: 1, y:-3, z: 7, v:13}),
    alg.mv("v3", {x: 2, y: 2, z:11, w:-3}),
  )
  : alg.mv("v", {wx: 4, xz: 7, yz:-5, uv: 3});

p(`${blade} ** 2
= ${alg.geometricProduct(blade, blade)}`);