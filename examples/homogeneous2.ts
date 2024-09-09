import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLBackEnd } from "../src/generateWebGL";

console.log(`// Homogeneous - WebGL
// [DFM09] p. 275, equation (11.1)
`);

const be = new WebGLBackEnd();
const coords = "xyzw";
const alg = new Algebra([1,1,1,-1], be, makeLetterNames(coords));

const [ex, ey, ez, ew] = alg.basisVectors();
const ew_inv = alg.inverse(ew);
be.emit(`// ew_inv: ${ew_inv}`);
const p = alg.mv("p", {x: "px", y: "py", z: "pz", w: "pw"});
be.emit(`// weight w: ${alg.contractLeft(ew_inv, p)}`);
be.emit(`// location: ${
  alg.geometricProduct(
    alg.contractLeft(ew_inv, alg.wedgeProduct(ew, p)),
    alg.inverse(alg.contractLeft(ew_inv, p)),
  )
}`);


console.log(be.text);
