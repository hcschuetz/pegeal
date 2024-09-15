import { expect, suite, test } from "vitest";
import { expectNearby, forAlgebras, forData, makeTwoVectors } from "./test-utils";


suite("geometric product - dummy back end", () => {
  suite("preserves unitness", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        const gp = alg.geometricProduct(alg.normalize(a), alg.normalize(b));
        expect(gp.knownUnit).toBe(true);
      });
    });
  });

  suite("commutes with norm(alization)", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
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
    forAlgebras(alg => {
      // This test is tailored to 1-vectors and will not work with other data:
      test("1-vectors", () => {
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
    });

  suite("geom/scalar/scalar", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
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
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        expectNearby(
          alg.contractRight(alg.reverse(b), alg.reverse(a)),
          alg.reverse(alg.contractLeft(a, b))
        );
      });
    });
  });

  suite("sandwich vs. geometric product", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        const sw = alg.sandwich(a, b.basisBlades())(b);
        const gp = alg.geometricProduct(a, b, alg.reverse(a));

        expectNearby(sw, gp);

        expect([...sw.basisBlades()]).not.to.include(7);
      });
    });
  });

  suite("inverse and geometric product", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        for (const mv of [
          a,
          b,
          // some more test data:
          alg.one(),
          ...alg.basisVectors(),
          alg.pseudoScalar(),
          alg.geometricProduct(a, b),
          alg.contractLeft(a, b),
          alg.exp(a),
        ]) {
          expectNearby(
            alg.geometricProduct(a, alg.inverse(a)),
            alg.one(),
          );

          expectNearby(
            alg.geometricProduct(alg.inverse(a), a),
            alg.one(),
          );
        }
      });
    });
  });

  suite("outermorphism and wedge product", () => {
    const matrix = [
      [4,  .2],
      [3, -.9,  5  ],
      [0,    , -4.2],
    ];
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        expectNearby(
          alg.wedgeProduct(
            alg.outermorphism(matrix, a),
            alg.outermorphism(matrix, b),
          ),
          alg.outermorphism(matrix, alg.wedgeProduct(a, b)),
        );
      });
    });
  });
});

// TODO test other kinds of products
