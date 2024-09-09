import { euclidean, p, q_ } from "./utils";
import { Algebra, BackEnd } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { WebGLBackEnd } from "../src/generateWebGL";
import { DummyBackEnd } from "../src/evalExpr";

p(`// Outermorphism - WebGL and eval\n`);

const coords = "xyzw";
const q = q_(coords);

const coords2 = "pqr";
const q2 = q_(coords2);

function testOM<T>(be: BackEnd<T>) {
  const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));
  const alg2 = new Algebra(euclidean(coords2), be, makeLetterNames(coords2));

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

const webBE = new WebGLBackEnd();
const result = testOM(webBE);
console.log(webBE.text);
console.log(`// result: ${result}`);

console.log("\n-------------\n")

q2("result", testOM(new DummyBackEnd()));
