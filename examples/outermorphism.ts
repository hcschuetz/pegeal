import { p, q_ } from "./utils";
import { euclidean } from "../src/euclidean";
import { Algebra, BackEnd, Scalar } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";
import NumericBackEnd from "../src/NumericBackEnd";

p(`// Outermorphism - WebGL and eval\n`);

const coords = "xyzw";
const coords2 = "pqr";
const q2 = q_(coords2);


function testOM<T>(
  be: BackEnd<T>,
  matrix: Scalar<T>[][], dataIn: Record<string, Scalar<T>>,
) {
  const alg = new Algebra(euclidean(coords), be, makeLetterNames(coords));
  const alg2 = new Algebra(euclidean(coords2), be, makeLetterNames(coords2));

  const mvIn = alg.mv(dataIn);
  return alg2.outermorphism(matrix, mvIn);
}


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
// partially symbolic:
const m4 = [
  /*         x     y    z     w */
  /* p */ [  ,     10],
  /* q */ [  ,     100, "foo"],
  /* r */ [  "bar",   , 1000 ],
];


q2("result", testOM(
  new NumericBackEnd(),
  m3,
  {
    "1": 1111,
    x: 5, y: 2, z: 3,
    xz: 8, yz: 7, xw: 6666666,
    xyz: 9,
  },
));

console.log("\n-------------\n")

const webBE = new WebGLBackEnd();
const result = testOM(
  webBE,
  m4,
  {
    "1": "scalar",
    // x: "x", y: "y", z: "z",
    xz: "xz", yz: "yz", xw: "xw",
    // xyz: "xyz",
  },
);
console.log(webBE.text);
console.log(`// result: ${result}`);
