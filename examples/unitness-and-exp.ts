import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { EvalBackEnd } from "../src/evalExpr";
import { deg, hideUnit, p, q_ } from "./utils";

p(`
// ------------------------------------------
// unitness and exp - eval
`);

const be = new EvalBackEnd();
const coords = "xyzw";
const alg = new Algebra([1,1,1,5], be, makeLetterNames(coords));
const q = q_(coords);

const B = alg.mv("B", {xy: .3, xz: .1, yz: .2});
q("|B|", alg.norm(B));
q("|B|", deg(alg.norm(B)));

const exp = alg.exp(B);
q("exp", exp);
q("|exp|", alg.norm(exp));
q("|exp| [computed]", alg.norm(hideUnit(alg, exp)));

const EXW = alg.mv("exw", {xw: 1})
const expEXW = alg.exp(EXW);
q("exp(EXW)", expEXW);
q("exp(EXW) w/o unit mark", hideUnit(alg, expEXW));
q("|exp(EXW)|", alg.norm(expEXW));
q("|exp(EXW)| [computed]", alg.norm(hideUnit(alg, expEXW)));
