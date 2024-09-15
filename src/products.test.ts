import { expect, suite, test } from "vitest";
import { euclidean } from "../examples/utils";
import { Algebra, Multivector } from "./Algebra";
import DummyBackEnd from "./DummyBackEnd";
import { makeLetterNames } from "./componentNaming";
import { expectNearby, forAlgebras, forDataFactories, makeTwoVectors } from "./test-utils";


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
