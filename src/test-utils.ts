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
  alg.mv({x: 0.7, y: 0.8, z: 0.9}),
  alg.mv({x: -0.4, y: 0.5, z: 0.2}),
  alg.mv({x: 0.3, y: 0.4, z: -0.5}),
]);

export const makeVersors: MVFactory = alg => ([
  alg.geometricProduct(alg.mv({x: .3, y: 2  }), alg.mv({x:  .9, y: -1})),
  alg.geometricProduct(alg.mv({x: .8, y: 1.1}), alg.mv({x: -.5, y: .4})),
  alg.geometricProduct(alg.mv({x: .5, y: 5  }), alg.mv({x:  .4, y: .3})),
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
