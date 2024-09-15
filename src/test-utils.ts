import { expect, suite, test } from "vitest";
import { euclidean } from "../examples/utils";
import { Algebra, Multivector } from "./Algebra";
import { makeLetterNames } from "./componentNaming";
import DummyBackEnd from "./DummyBackEnd";

const coords = "xyz";


const metrics = [euclidean(coords), [3, 0.9, -0.2], [0, 4.4, 2]];

/** Run the function in a test body with algebras for all our metrics. */
export function forAlgebras(fn: (algebra: Algebra<never>) => void) {
  for (const metric of metrics) {
    test(`with metric ${JSON.stringify(metric)}`, () => {
      fn(new Algebra(metric, new DummyBackEnd(), makeLetterNames(coords)));
    });
  }
}


export type MVFactory = (alg: Algebra<never>) => {
  a: Multivector<never>;
  b: Multivector<never>;
};

export const makeTwoVectors = (alg: Algebra<never>) => ({
  a: alg.mv("a", {x: 0.7, y: 0.8, z: 0.9}),
  b: alg.mv("b", {x: -0.4, y: 0.5, z: 0.2}),
});

export const makeTwoRotors = (alg: Algebra<never>) => ({
  a: alg.geometricProduct(alg.mv("a1", {x: .3, y: 2}), alg.mv("a2", {x: .9, y: -1})),
  b: alg.geometricProduct(alg.mv("b1", {x: .8, y: 1.1}), alg.mv("b2", {x: -.5, y: .4})),
});

const dataFactories: [string, MVFactory][] = [
  ["1-vectors", makeTwoVectors],
  ["rotors"   , makeTwoRotors ],
];

/** Run the function in a test-suite body with all our data factories. */
export function forDataFactories(fn: (mvFactory: MVFactory) => void) {
  for (const [name, mvFactory] of dataFactories) {
    suite(name, () => fn(mvFactory));
  }
}


// TODO Move this functionality to a Chai plugin?
export const expectNearby = (a: Multivector<never>, b: Multivector<never>) =>
  expect(a.alg.dist(a, b)).toBeCloseTo(0);
