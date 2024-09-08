import { euclidean, p, q_ } from "./utils";
import { Algebra, Context } from "../Algebra";
import { makeLetterNames } from "../componentNaming";
import { WebGLContext } from "../generateWebGL";
import { EvalContext } from "../evalExpr";

p(`// Outermorphism - WebGL and eval\n`);

const coords = "xyzw";
const q = q_(coords);

const coords2 = "pqr";
const q2 = q_(coords2);

function testOM<T>(ctx: Context<T>) {
  const alg = new Algebra(euclidean(coords), ctx, makeLetterNames(coords));
  const alg2 = new Algebra(euclidean(coords2), ctx, makeLetterNames(coords2));

  const m1 =  [
    /*         x   y    z     w */
    /* p */ [  10],
    /* q */ [  ,   100],
    /* r */ [  ,   ,    1000],
  ];
  const m2 =  [
    /*         x   y    z     w */
    /* p */ [  ,   ,    1000],
    /* q */ [  ,   100],
    /* r */ [  10],
  ];
  const m2a =  [
    /*         x   y    z     w */
    /* p */ [  10],
    /* q */ [  ,   ,    1000],
    /* r */ [  ,   100],
  ];
  const m3 =  [
    /*         x   y    z     w */
    /* p */ [  ,   10],
    /* q */ [  ,   100, .001],
    /* r */ [  .1, ,    1000],
  ];

  const A = alg.mv("A", {
    "1": 1111,
    x: 5, y: 2, z: 3,
    xz: 8, yz: 7, xw: 6666666,
    xyz: 9,
  });

  return alg2.outermorphism(A, m3);
}

const webCtx = new WebGLContext();
const result = testOM(webCtx);
console.log(webCtx.text);
console.log(`// result: ${result}`);

console.log("\n-------------\n")

q2("result", testOM(new EvalContext()));
