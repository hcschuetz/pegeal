import { expect, suite, test } from "vitest";
import { euclidean } from "./euclidean";
import { Algebra, Multivector } from "./Algebra";
import { makeLetterNames } from "./componentNaming";
import NumericBackEnd from "./NumericBackEnd";

const coords = "xyz";


const metrics = [euclidean(coords), [3, 0.9, -0.2], [0, 4.4, 2]];

/** Run the function in a test body with algebras for all our metrics. */
export function forAlgebras(fn: (algebra: Algebra<never>) => void) {
  for (const metric of metrics) {
    suite(`with metric ${JSON.stringify(metric)}`, () => {
      fn(new Algebra(metric, new NumericBackEnd(), makeLetterNames(coords)));
    });
  }
}


export type MVFactory = (alg: Algebra<never>) => ([
  Multivector<never>,
  Multivector<never>,
  Multivector<never>,
]);

export const makeVectors: MVFactory = alg => ([
  alg.vec([ 0.7, 0.8,  0.9]),
  alg.vec([-0.4, 0.5,  0.2]),
  alg.vec([ 0.3, 0.4, -0.5]),
]);

export const makeVersors: MVFactory = alg => ([
  alg.geometricProduct(alg.vec([.3, 2  , 0]), alg.vec([ .9, -1, 0])),
  alg.geometricProduct(alg.vec([.8, 1.1, 0]), alg.vec([-.5, .4, 0])),
  alg.geometricProduct(alg.vec([.5, 5  , 0]), alg.vec([ .4, .3, 0])),
]);

const dataFactories: [string, MVFactory][] = [
  ["1-vectors", makeVectors],
  ["versors"  , makeVersors],
];

/** Run the function in a test body with all our data factories. */
export function forData(
  alg: Algebra<never>,
  fn: (a: Multivector<never>, b: Multivector<never>, c: Multivector<never>) => void,
) {
  for (const [name, mvFactory] of dataFactories) {
    test(name, () => fn(...mvFactory(alg)));
  }
}


// TODO Move this functionality to a Chai plugin?
export const expectNearby = (a: Multivector<never>, b: Multivector<never>) =>
  expect(a.alg.dist(a, b)).toBeCloseTo(0);
