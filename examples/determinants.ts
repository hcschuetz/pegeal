import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { p, q_ } from "./utils";

p(`// Determinants - eval\n`);
  
  const be = new DummyBackEnd();
  
  const coords = "xyz";
  const q = q_(coords);
  const alg = new Algebra([2,3,5], be, makeLetterNames(coords));
  
  const coords2 = "pqr";
  const q2 = q_(coords2);
  const alg2 = new Algebra([4, 5, 6], be, makeLetterNames(coords2));
  
  const m =  [
    /*         x   y    z */
    /* p */ [  ,   10],
    /* q */ [  ,   100, .001],
    /* r */ [  .1, ,    1000],
  ];
  
  const I = alg.pseudoScalar();
  q("I", I);
  q("|I|", alg.norm(I));
  
  const mI = alg2.outermorphism(I, m);
  q2("f_m(I)", mI);
  q2("|f_m(I)|", alg2.norm(mI));
  
  
  q("det(m)", mI.value(alg2.fullBitmap));
  // The determinant of the linear mapping f_m,
  // which also takes the metrics into account:
  q("det(f_m)", alg2.norm(mI) / alg.norm(I));
  
  // The definition of a determinant in [DFM09], p. 106, formula (4.7) assumes
  // an endomorphisms (co-domain === domain).  So the identical metrics of
  // domain and co-domain cancel each other out and thus the mapping determinant
  // coincides with the matrix determinant.
  q("det(endomorphism)", alg.norm(alg.outermorphism(I, m)) / alg.norm(I));
  