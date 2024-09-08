import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { EvalContext } from "../src/evalExpr";
import { p, q_ } from "./utils";

p(`// Normalization - eval\n`);

const coords = "xyzw";
const q = q_(coords);

function test_normalize(m: number[]) {
  const alg = new Algebra(m, new EvalContext(), makeLetterNames(coords));

  const B1 = alg.mv("B1", {x: 5, y: 2, z: 3});
  const B2 = alg.mv("B2", {x: 2, y:-1, z: 2});
  const B3 = alg.mv("B3", {x:-1, y: 4, z:-1});

  p("-----------");
  q("normalize(one)", alg.normalize(alg.one()));
  q("normalize(ex)", alg.normalize(alg.basisVectors()[0]));
  q("normalize(B1)", alg.normalize(B1));
  q("normalize(B1^B2)", alg.normalize(alg.wedgeProduct(B1, B2)));
  q("normalize(B1 B2)", alg.normalize(alg.geometricProduct(B1, B2)));
  q("normalize(B1 B2 B3)", alg.normalize(alg.geometricProduct(B1, B2, B3)));
  p();
  p("// Normalization distributes over geometric products:");
  q("normalize(B1) normalize(B2) normalize(B3)",
    alg.geometricProduct(alg.normalize(B1), alg.normalize(B2), alg.normalize(B3))
  );
  q("normalize(B1) normalize(B2 B3)",
    alg.geometricProduct(alg.normalize(B1), alg.normalize(alg.geometricProduct(B2, B3)))
  );
  p("// But it does not distribute over wedge products:")
  q("normalize(B1)^normalize(B2)",
    alg.wedgeProduct(alg.normalize(B1), alg.normalize(B2))
  );
}

for (let m of [[1,1,1,1],[2,-3,4,1]]) {
  test_normalize(m);
}
