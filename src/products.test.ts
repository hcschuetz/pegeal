import { expect, suite, test } from "vitest";
import { euclidean } from "../examples/utils";
import { Algebra, Multivector } from "./Algebra";
import DummyBackEnd from "./DummyBackEnd";
import { makeLetterNames } from "./componentNaming";

const coords = "xyz";


const metrics = [euclidean(coords), [3, 0.9, -0.2], [0, 4.4, 2]];

/** Run the function in a test body with algebras for all our metrics. */
function forAlgebras(fn: (algebra: Algebra<never>) => void) {
  for (const metric of metrics) {
    test(`with metric ${JSON.stringify(metric)}`, () => {
      fn(makeAlgebra(metric));
    });
  }
}


const makeAlgebra = (metric: number[]) =>
  new Algebra(metric, new DummyBackEnd(), makeLetterNames(coords));

type MVFactory = (alg: Algebra<never>) => {
  a: Multivector<never>;
  b: Multivector<never>;
};

const makeTwoVectors = (alg: Algebra<never>) => ({
  a: alg.mv("a", {x: 0.7, y: 0.8, z: 0.9}),
  b: alg.mv("b", {x: -0.4, y: 0.5, z: 0.2}),
});

const makeTwoRotors = (alg: Algebra<never>) => ({
  a: alg.geometricProduct(alg.mv("a1", {x: .3, y: 2}), alg.mv("a2", {x: .9, y: -1})),
  b: alg.geometricProduct(alg.mv("b1", {x: .8, y: 1.1}), alg.mv("b2", {x: -.5, y: .4})),
});

const dataFactories: [string, MVFactory][] = [
  ["1-vectors", makeTwoVectors],
  ["rotors"   , makeTwoRotors ],
];

/** Run the function in a test-suite body with all our data factories. */
function forDataFactories(fn: (mvFactory: MVFactory) => void) {
  for (const [name, mvFactory] of dataFactories) {
    suite(name, () => fn(mvFactory));
  }
}

// TODO Move this functionality to a Chai plugin?
const expectNearby = (a: Multivector<never>, b: Multivector<never>) =>
  expect(a.alg.dist(a, b)).toBeCloseTo(0);


suite("geometric product - dummy back end", () => {
  suite("preserves unitness", () => {
    forDataFactories((mvFactory) => {
      forAlgebras(alg => {
        const {a, b} = mvFactory(alg);

        const aU = alg.normalize(a);
        const bU = alg.normalize(b);

        expect(alg.geometricProduct(aU, bU).knownUnit).toBe(true);
      });
    });
  });

  suite("commutes with norm(alization)", () => {
    forDataFactories((mvFactory) => {
      forAlgebras(alg => {
        const {a, b} = mvFactory(alg);

        expect(alg.norm(alg.geometricProduct(a, b)))
        .toBeCloseTo((alg.norm(a) * alg.norm(b)));

        expect(alg.normSquared(alg.geometricProduct(a, b)))
        .toBeCloseTo((alg.normSquared(a) * alg.normSquared(b)));

        expectNearby(
          alg.normalize(alg.geometricProduct(a, b)),
          alg.geometricProduct(alg.normalize(a), alg.normalize(b))
        );
      });
    });
  });
});

suite("product relationships - dummy back end", () => {
  suite("geom/wedge/scalar", () => {
    suite("1-vectors", () => {
      forAlgebras(alg => {
        const {a, b} = makeTwoVectors(alg);

        expectNearby(
          alg.extractGrade(2, alg.geometricProduct(a, b)),
          alg.wedgeProduct(a, b),
        );

        expectNearby(
          alg.plus(
            alg.wedgeProduct(a, b),
            alg.scalarProductMV(a, b),
          ),
          alg.geometricProduct(a, b),
        );
      });
    });
    // The test above is tailored to 1-vectors and will not work with rotors.
    });

  suite("geom/scalar/scalar", () => {
    forDataFactories((mvFactory) => {
      forAlgebras(alg => {
        const {a, b} = mvFactory(alg);

        expectNearby(
          alg.extractGrade(0, alg.geometricProduct(a, b)),
          alg.scalarProductMV(a, b),
        );

        expect(alg.geometricProduct(a, b).value(0))
        .toBeCloseTo(alg.scalarProduct(a, b));
      });
    });
  });

  suite("contraction left and right", () => {
    forDataFactories((mvFactory) => {
      forAlgebras(alg => {
        const {a, b} = mvFactory(alg);

        expectNearby(
          alg.contractRight(alg.reverse(b), alg.reverse(a)),
          alg.reverse(alg.contractLeft(a, b))
        );
      });
    });
  });
});

// TODO test other kinds of products
