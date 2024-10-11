import { expect, suite, test } from "vitest";
import { expectNearby, forAlgebras, forData, makeVectors } from "./test-utils";
import { Multivector, productFlips, reverseFlips } from "./Algebra";


// TODO test geometric and wedge product with 0/1/3 arguments

suite("geometric product - numeric back end", () => {
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

        // If the pseudoscalar squares to 0 we cannot use `alg.dual(...)`, but
        // the regressive product works in that case as well since it is
        // actually non-metric.  So we can use a duality based on any metric.
        // The most straight-forward choice is the Euclidean metric.
        // (See also [DFM09], p. 135, last paragraph, where the same idea is
        // explained for the `meet` operation, which is closely related to the
        // regressive product.)
        expectNearby(
          alg.regressiveProduct(),
          euclideanUndual(alg.wedgeProduct()),
        );
        expectNearby(
          alg.regressiveProduct(a),
          euclideanUndual(alg.wedgeProduct(euclideanDual(a))),
        );
        expectNearby(
          alg.regressiveProduct(a, b),
          euclideanUndual(alg.wedgeProduct(euclideanDual(a), euclideanDual(b))),
        );
        expectNearby(
          alg.regressiveProduct(a, b, c),
          euclideanUndual(alg.wedgeProduct(euclideanDual(a), euclideanDual(b), euclideanDual(c))),
        );
    });
    });
  });
});

// TODO move these to the Algebra class?
function euclideanDual<T>(mv: Multivector<T>) {
  const {alg} = mv;
  const {fullBitmap} = alg;
  return new Multivector(alg, "dual", add => {
    for (const [bm, val] of mv) {
      const flips = productFlips(fullBitmap ^ bm, fullBitmap);
      add(bm ^ fullBitmap, alg.flipIf(flips & 1, val));
    }
  });
}
function euclideanUndual<T>(mv: Multivector<T>) {
  // TODO negate only for certain values of mv.alg.nDimensions?
  // (Perhaps only for 2, 3, 6, 7, 10, 11, ...?)
  // We should actually run this entire test file with several algebra
  // dimensionalities.
  return mv.alg.negate(euclideanDual(mv));
}

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
          expectNearby(euclideanUndual(euclideanDual(x)), x);
          expectNearby(euclideanDual(euclideanUndual(x)), x);
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
