import { expect, suite, test } from "vitest";
import { expectNearby, expectUnit, forAlgebras, forData, makeVectors } from "./test-utils";


// TODO test geometric and wedge product with 0/1/3 arguments

suite("geometric product - numeric back end", () => {
  suite("preserves unitness", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        const gp = alg.geometricProduct(alg.normalize(a), alg.normalize(b));
        expectUnit(alg.normSquared(gp));
        // TODO check knownSqNorm in various other situations
        // (But we do not have knownSqNorm if it is configured away.)
      });
    });
  });

  suite("commutes with norm(alization)", () => {
    forAlgebras(alg => {
      forData(alg, (a, b) => {
        if (alg.normSquared(a) >= 0 && alg.normSquared(b) >= 0) {
          expect(alg.norm(alg.geometricProduct(a, b)))
          .toBeCloseTo(alg.norm(a) * alg.norm(b));
        }

        expect(alg.normSquared(alg.geometricProduct(a, b)))
        .toBeCloseTo(alg.normSquared(a) * alg.normSquared(b));

        expectNearby(
          alg.normalize(alg.geometricProduct(a, b)),
          alg.geometricProduct(alg.normalize(a), alg.normalize(b))
        );
      });
    });
  });
});

suite("normalization - numeric back end", () => {
  forAlgebras(alg => {
    forData(alg, (a, b) => {
      expectUnit(alg.normSquared(alg.normalize(a)));
      expectUnit(alg.normSquared(alg.normalize(b)));
      expectUnit(alg.normSquared(alg.normalize(alg.wedgeProduct(a, b))));
    });
  });
})

suite("product relationships - numeric back end", () => {
  suite("geom/wedge/scalar", () => {
    forAlgebras(alg => {
      // This test is tailored to 1-vectors and will not work with other data:
      test("1-vectors", () => {
        const [a, b] = makeVectors(alg);

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
      forData(alg, (a, b, c) => {
        for (const mv of [
          a,
          b,
          c,
          // some more test data:
          alg.one(),
          ...alg.basisVectors(),
          alg.pseudoScalar(),
          alg.geometricProduct(a, b),
          alg.contractLeft(a, b),
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

  suite("regressive and wedge product, dualization", () => {
    forAlgebras(alg => {
      forData(alg, (a, b, c) => {
        if (alg.normSquared(alg.pseudoScalar()) !== 0) {
          expectNearby(
            alg.regressiveProduct(),
            alg.undual(alg.wedgeProduct()),
          );
          expectNearby(
            alg.regressiveProduct(a),
            alg.undual(alg.wedgeProduct(alg.dual(a))),
          );
          expectNearby(
            alg.regressiveProduct(a, b),
            alg.undual(alg.wedgeProduct(alg.dual(a), alg.dual(b))),
          );
          expectNearby(
            alg.regressiveProduct(a, b, c),
            alg.undual(alg.wedgeProduct(alg.dual(a), alg.dual(b), alg.dual(c))),
          );
        }
        expectNearby(
          alg.regressiveProduct(),
          alg.euclideanUndual(alg.wedgeProduct()),
        );
        expectNearby(
          alg.regressiveProduct(a),
          alg.euclideanUndual(alg.wedgeProduct(alg.euclideanDual(a))),
        );
        expectNearby(
          alg.regressiveProduct(a, b),
          alg.euclideanUndual(alg.wedgeProduct(alg.euclideanDual(a), alg.euclideanDual(b))),
        );
        expectNearby(
          alg.regressiveProduct(a, b, c),
          alg.euclideanUndual(alg.wedgeProduct(alg.euclideanDual(a), alg.euclideanDual(b), alg.euclideanDual(c))),
        );
    });
    });
  });
});

suite("dual", () => {
  forAlgebras(alg => {
    // Cannot compute a dual if the pseudoscalar is not invertible.
    if (alg.normSquared(alg.pseudoScalar()) !== 0) {
      suite("metric dual", () => {
        forData(alg, (a, b, c) => {
          for (const x of [a, b, c, alg.one(), alg.pseudoScalar(), ...alg.basisVectors()]) {
            expectNearby(alg.undual(alg.dual(x)), x);
            expectNearby(alg.dual(alg.undual(x)), x);
          }
        });
      });
    }
    suite("euclidean dual", () => {
      forData(alg, (a, b, c) => {
        for (const x of [a, b, c, alg.plus(alg.geometricProduct(a, b), c)]) {
          expectNearby(alg.euclideanUndual(alg.euclideanDual(x)), x);
          expectNearby(alg.euclideanDual(alg.euclideanUndual(x)), x);
        }
      });
    });
  });
});

suite("pseudoscalar", () => {
  forAlgebras(alg => {
    test("should be equal to product of basis vectors", () => {
      expectNearby(
        alg.pseudoScalar(),
        alg.wedgeProduct(...alg.basisVectors()),
      );
    });
  });
});

// TODO test other kinds of products
