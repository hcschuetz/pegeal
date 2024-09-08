import { Algebra } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { WebGLContext } from "../generateWebGL";

console.log(`// Homogeneous - WebGL
// [DFM09] p. 275, equation (11.1)
`);

const ctx = new WebGLContext();
const coords = "xyzw";
const alg = new Algebra([1,1,1,-1], ctx, makeLetterNames(coords));

const [ex, ey, ez, ew] = alg.basisVectors();
const ew_inv = alg.inverse(ew);
ctx.emit(`// ew_inv: ${ew_inv}`);
const p = alg.mv("p", {x: "px", y: "py", z: "pz", w: "pw"});
ctx.emit(`// weight w: ${alg.contractLeft(ew_inv, p)}`);
ctx.emit(`// location: ${
  alg.geometricProduct(
    alg.contractLeft(ew_inv, alg.wedgeProduct(ew, p)),
    alg.inverse(alg.contractLeft(ew_inv, p)),
  )
}`);


console.log(ctx.text);
