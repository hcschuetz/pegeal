import { Algebra, bitCount, Factor, MultiVector } from "./Algebra";

/*
Outermorphism
-------------

(See also [DFM09], chapter 4.)

Applying a linear mapping `f` to a multivector `A`:

    f(A)
    = // Let A := sum{b in A.baseblades} A_b b
      // b is a set of base vectors (technically represented as bitmap).
      // It is also used as an index in A to access the corresponding
      // magnitude A_b.
    f(sum{b in A.baseblades} A_b b)
    = // linearity
    sum{b in A.baseblades} A_b f(b)
    = // Let b := ⋀{e_i in b} e_i
      // e_i is the i-th base vector in the domain
    sum{b in A.baseblades} A_b f(⋀{e_i in b} e_i)
    = // distribute f
    sum{b in A.baseblades} A_b ⋀{e_i in b} f(e_i)
    = // Let f be given as matrix M:
      // f(e_i) = sum{j} M_ji E_j
      // i: column index, j: row index, E_j: j-th base vector in the co-domain
    sum{b in A.baseblades} A_b ⋀{e_i in b} sum{j} M_ji E_j
                               ---------------------------

We implement the underlined expression
- recursively along the domain basis ("e_i in b") and
- iteratively along the co-domain basis ("j").

Recursion terminates in multiple ways:
- Without contributing a value if M_ji === 0 (or missing in a sparse matrix).
- Without contributing a value if E_j is already in the recursion path.
- Contributing a value if the end of the bitmap b has been reached,
  that is, (1 << i) > b.

Parameters of the recursive function:
- The current value of i.  Skip i values that are not set in b.
- The accumulated bitmap of E_j indices so that
  - duplicate E_j can be detected and
  - the accumulated value will be contributed to the output component
    corresponding to the accumulated bitmap.
- The accumulated number of flips (adjacent transpositions)
  for permuting the output basis vectors into the proper order.
- An accumulated "value":
  - Start with A_b and
  - multiply (symbolically) with M_ji in each recursion step.
*/

export class Outermorphism<T> {
  constructor(
    readonly domain: Algebra<T>,
    readonly codomain: Algebra<T>,
    /** matrix in row-major order, possibly sparse */
    readonly matrix: (Factor<T> | undefined)[][],
  ) {}

  apply(mv: MultiVector<T>): MultiVector<T> {
    const {domain, codomain, matrix} = this;
    domain.checkMine(mv);
    return new MultiVector(codomain, "morph", c => {
      mv.forComponents((bitmapIn, f) => {
        function recur(i: number, bitmapOut: number, flips: number, product: Factor<T>[]) {
          const iBit = 1 << i;
          if (iBit > bitmapIn) {
            // Fully traversed bitmapIn.  Contribute to the output:
            c(bitmapOut).add([...(flips & 1 ? [-1] : []), ...product, f]);
          } else if (!(iBit & bitmapIn)) {
            // The i-th basis vector is not in bitmapIn.  Skip it:
            recur(i + 1, bitmapOut, flips, product);
          } else {
            // The i-th basis vector is in bitmapIn.
            // Recur for the "appropriate" codomain basis vectors:
            for (let j = 0; j < codomain.nDimensions; j++) {
              const jBit = 1 << j;
              if (jBit & bitmapOut) continue; // wedge prod with duplicate is 0
              const elem = (matrix[j] ?? [])[i] ?? 0;
              if (elem === 0) continue; // omit product with a factor 0
              // TODO check flip management for correctness
              const newFlips = bitCount(bitmapOut & ~(jBit - 1));
              recur(i + 1, bitmapOut | jBit, flips + newFlips, [...product, elem]);
            }
          }
        }

        recur(0, 0, 0, []);
      });
    });
  }
}

/*
TODO Actually parameters `domain` and `codomain` of an `Outermorphism`
need not be as powerful as class Algebra, which should be renamed to
`OrthogonalAlgebra`.

The class hierarchy would be:
- Algebra
  - OrthogonalAlgebra (~ today's class Algebra)
    - EuclideanAlgebra
  - NonOrthogonalAlgebra
    - ConformalAlgebra

Notes:
- Euclidean and conformal algebra need not be separate subclasses.
  They might just be (non-)orthogonal algebras with appropriate behavior.
- A NonOrthogonalAlgebra manages two kinds of multivectors:
  - "local" multivectors
  - multivectors of an underlying (typically orthogonal) algebra
*/
