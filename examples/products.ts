import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import DummyBackEnd from "../src/DummyBackEnd";
import { p, q_ } from "./utils";

{
  const be = new DummyBackEnd();
  const alg = new Algebra([1,2,3], be, makeLetterNames("xyz"));
  const q = q_("xyz");

  const v = alg.mv("v", {x: 4, y: 11});
  q("v", v);
  q("geomProd(v, v)", alg.geometricProduct(v, v));
  q("contractRight(v, v)", alg.contractRight(v, v));

  const bv = alg.mv("bv", {xy: 3, yz: 5});
  q("bv", bv);
  q("geomProd(bv, v)", alg.geometricProduct(bv, v));
  q("geomProd(v, bv)", alg.geometricProduct(v, bv));
  q("geomProd(bv, bv)", alg.geometricProduct(bv, bv));
  p(`
It is not a coincidence that the xz component of the latter product is 0.
It comes from using bv twice:

  geometricProduct(bv, bv).xz
  = bv.xy * bv.yz + bv.yz * bv.xy
  = bv.xy * bv.yz - bv.xy * bv.yz
  = 0

But the compiler does not understand this and does therefore not remove the
xz component from the result.

Same for

  geometricProduct(v, v).xy
  = v.x * v.y + v.y * v.x 
  = v.x * v.y - v.x * v.y
  = 0 

Even simpler (but less realistic) examples where the compiler does not
recognize that components will always be zero are the subtraction expressions

  bv - bv = ${alg.plus(bv, alg.negate(bv))}

and

  v - v = ${alg.plus(v, alg.negate(v))}.

----
`);

  p(""+v, ""+alg.reverse(v));
  p(""+bv, ""+alg.reverse(bv));
  p("geometricProd(v, ~v): " + alg.geometricProduct(v, alg.reverse(v)));
  p("geometricProd(bv, ~bv): " + alg.geometricProduct(bv, alg.reverse(bv)));
  p("scalarProd(v, ~v): " + alg.scalarProduct(v, alg.reverse(v)));
  p("scalarProd(bv, ~bv): " + alg.scalarProduct(bv, alg.reverse(bv)));
  p("-----");
  p("scalarProd(v, v): " + alg.scalarProduct(v, v));
  p("scalarProd(bv, bv): " + alg.scalarProduct(bv, bv));
  p("contractLeft(v, bv): " + alg.contractLeft(v, bv));
  p("contractRight(bv, v): " + alg.contractRight(bv, v));
  p("dotProduct(v, v): " + alg.dotProduct(v, v));
  p("dotProduct(bv, bv): " + alg.dotProduct(bv, bv));
  p("-----");
  p("normSquared(v): " + alg.normSquared(v));
  p("normSquared(bv): " + alg.normSquared(bv));
  p("inv(v): " + alg.inverse(v));
  p("inv(bv): " + alg.inverse(bv));
  p("-----");
  p("ps: " + alg.pseudoScalar());
  p("psi: " + alg.pseudoScalarInv());
  p("dual(v): " + alg.dual(v));
  p("dual(bv): " + alg.dual(bv));
}
