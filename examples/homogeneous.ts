import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import { p, q_ } from "./utils";

p(`Homogeneous coords - WebGL
[DFM09] p. 275, equation (11.1)
`);

for (const metric_w of [1, -1, "metric_w"]) {
  p("-------------------------------------------")

  const coords = "xyzw";
  const be = new WebGLBackEnd();
  const alg = new Algebra([1,1,1,metric_w], be, makeLetterNames(coords));

  // output helpers
  const c = (text: string) => be.emit("// " + text);
  const q = q_(coords, c);

  q("metric_w", metric_w);
  c("")
  const [ex, ey, ez, ew] = alg.basisVectors();
  const ewInv = alg.inverse(ew);
  q("ewInv", ewInv);

  const point = alg.vec(["px", "py", "pz", "pw"]);

  // With our optimizations (and the expected optimizations by the WebGL
  // compiler) the extractions of weight and location should be as efficient
  // as in hand-written code:
  const weight = alg.contractLeft(ewInv, point);
  q("weight", weight);

  q("location",
    alg.geometricProduct(
      alg.contractLeft(ewInv, alg.wedgeProduct(ew, point)),
      alg.inverse(weight),
    )
  );

  p(be.text);
}
