export type Factor<T> = number | T;
export type Term<T> = Factor<T>[];

export interface MultiVector<T> {
  add(bm: number, term: Term<T>): this;
  forComponents(callback: (bitmap: number, value: Factor<T>) => unknown): unknown;
  get(bitmap: number): Factor<T> | undefined;
}

/*
TODO Should we also have special types for other grades such as 1 and n?

It probably makes most sense to have a subclass for unit multivectors:
- Operations creating unit vectors by construction should return such a vector:
  - normalization
  - basis vectors if the corresponding metric component is 1
  - more?
- normSquared(mv) then simply returns the constant scalar 1.
  (That should suffice for optimization in the subsequent compilation.)
- inverse(mv) simply returns its argument.
To solve this in an object-oriented way (inheritance + selective overriding)
we would have to implement normSquared(mv) and inverse(mv) as methods of
the multivector, not the algebra.

Alternatively we could just add a boolean "definitelyUnit" to MultiVector<T>
without subclassing.  It is false by default and can be set using a method
mv.markAsUnit().  Then we can optimize after checking this flag.

CAUTION: Norm and unitness depend on the metric and thus on the algebra.
They are NOT properties of just the Multivector seen as a mapping from bitmaps
to numbers.  So it might make sense to re-introduce the algebra pointer
(or at least a metric pointer) in multivectors and checkMine(mv).
(We need the algebra/metric pointer anyway for implementing mv.normSquared().)

BTW, is the geometric product of two unit mvs again a unit mv?
More generally:  Does the norm (or equivalently the squared norm) commute
with the geometric product?
In the Euclidean case probably yes.  Otherwise ???
Other products of units are not unit because their norm involves the angle
between the two arguments.

And would a flag or subclass for invertible MVs help?

A specialized type for versors might help.  Only versors support
normSquared(...) and inverse(...), at least with their current efficient
implementation.  General multivectors get no support or less efficient code.
(See section 21.2 of Dorst/Fontijne/Mann.)
*/

/**
 * Not sure if we need this.  We could just use a MultiVector having (at most)
 * the scalar component.  But using `Scalar` makes it clear in the TS/JS code
 * that no other components are present.
 */
export interface Scalar<T> extends MultiVector<T> {
  add0(term: Term<T>): this;
  get0(): Factor<T> | undefined;
}

export abstract class AbstractScalar<T> implements Scalar<T> {
  abstract add0(term: Term<T>): this;
  abstract get0(): Factor<T> | undefined;

  add(bm: number, term: Term<T>): this {
    if (bm !== 0) {
      throw "Cannot add to non-scalar component of scalar";
    }
    this.add0(term);
    return this;
  }

  get(bm: number) {
    return (bm === 0) ? this.get0() : undefined;
  }

  forComponents(callback: (bitmap: number, value: Factor<T>) => unknown) {
    const value = this.get0();
    if (value !== undefined) {
      callback(0, value);
    }
  }
}

export interface Context<T> {
  makeScalar(nameHint: string): Scalar<T>;
  makeMultiVector(nameHint: string): MultiVector<T>;
  invertFactor(f: Factor<T>): Factor<T>;
  // TODO more operations on scalars such as sqrt, trig functions, ...
}

/** For each 1 bit in the bitmap, invoke the callback with the bit position. */
export function forBitmap(bm: number, callback: (direction: number) => unknown): void {
  for (let i = 0, bit = 1; bit <= bm; i++, bit <<= 1) {
    if (bm & bit) {
      callback(i);
    }
  }
}

export function bitList(bm: number): number[] {
  const result: number[] = [];
  forBitmap(bm, i => result.push(i));
  return result;
}

// See https://graphics.stanford.edu/%7Eseander/bithacks.html#CountBitsSetNaive
// and subsequent solutions for alternative implementations.
export function getGrade(bitmap: number) {
  let result = 0;
  // Kernighan method:
  while (bitmap) {
    bitmap &= bitmap - 1;
    result++;
  }
  // // Naive version:
  // forBitmap(bitmap, () => result++);
  return result;
}

type ProductKind = "wedge" | "geom" | "contrL" | "contrR" | "dot" | "scalar";

/**
 * For each product kind a test whether the combination of two basis blades
 * (represented as bitmaps) should be skipped in the product.
 * The result is technically a number but is to be used as a boolean.
 */
const productSkip: Record<ProductKind, (bmA: number, bmB: number) => number> = {
  wedge:  (bmA, bmB) => bmA & bmB,
  geom:   (bmA, bmB) => 0,
  contrL: (bmA, bmB) => bmA & ~bmB,
  contrR: (bmA, bmB) => ~bmA & bmB,
  dot:    (bmA, bmB) => bmA & ~bmB | ~bmA & bmB,
  scalar: (bmA, bmB) => bmA ^ bmB,
};

/**
 * The number of adjacent transpositions needed for the product of
 * two basis blades (represented as bitmaps).
 */
export function productFlips(bitmapA: number, bitmapB: number): number {
  let flips = 0;
  let bCount = 0;
  for (let bit = 1; bit <= bitmapA; bit <<= 1) {
    if (bit & bitmapA) {
      flips += bCount;
    }
    if (bit & bitmapB) {
      bCount++;
    }
  }
  return flips;
}

/** Provide factor -1 if argument is truthy. */
const flipSign = (doFlip: number): Term<never> => doFlip ? [-1] : [];

export class Algebra<T> {
  readonly nDimensions: number;
  readonly fullBitmap: number;
  readonly metric: Factor<T>[];
  readonly ctx: Context<T>;

  constructor(
    metric: Factor<T>[],
    ctx: Context<T>,
  ) {
    this.metric = metric;
    this.ctx = ctx;
    this.nDimensions = metric.length;
    this.fullBitmap = (1 << metric.length) - 1;
  }

  /** Return a term for the metric or `undefined` if the term is always 0. */
  metricFactors(bm: number): Term<T> | undefined {
    const result = [];
    for (const i of bitList(bm)) {
      const f = this.metric[i];
      switch (f) {
        case 0: return undefined;
        case 1: break;
        default: result.push(f);
      }
    }
    return result;
  }

  zero(): Scalar<T> {
    return this.ctx.makeScalar("zero");
  };
  one(): Scalar<T> {
    return this.ctx.makeScalar("one").add0([]);
  }
  pseudoScalar(): MultiVector<T> {
    // return this.wedgeProduct(...this.basisVectors());
    return this.ctx.makeMultiVector("ps").add(this.fullBitmap, []);
  }
  pseudoScalarInv(): MultiVector<T> {
    // TODO implement directly?
    return this.inverse(this.pseudoScalar());
  }
  basisVectors(): MultiVector<T>[] {
    return this.metric.map((_, i) =>
      this.ctx.makeMultiVector("basis" + i).add(1 << i, [])
    )
  }

  // TODO Move the methods taking a single MultiVector to the MultiVector class?

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Factor<T>, mv: MultiVector<T>): MultiVector<T> {
    switch (alpha) {
      case 0: return this.ctx.makeMultiVector("scale0");
      case 1: return mv;
      default: {
        const result = this.ctx.makeMultiVector("scale");
        mv.forComponents((bm, val) => result.add(bm, [alpha, val]));
        return result;
      }
    }
  }

  negate(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("negate");
    mv.forComponents((bm, val) => result.add(bm, [-1, val]));
    return result;
  }

  gradeInvolution(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("gradeInvolution");
    mv.forComponents((bm, val) => result.add(bm, [...flipSign(getGrade(bm) & 1), val]));
    return result;
  }

  reverse(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("reverse");
    mv.forComponents((bm, val) => result.add(bm, [...flipSign(getGrade(bm) & 2), val]));
    return result;
  }

  dual(mv: MultiVector<T>): MultiVector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
    // TODO Implement directly.
  }

  /**
   * Short for `this.scalarProduct(mv, this.reverse(mv))`.
   * **This is only correct for versors!**
   */
  normSquared(mv: MultiVector<T>): Scalar<T> {
    const result = this.ctx.makeScalar("normSquared");
    mv.forComponents((bm, val) => {
      const mf = this.metricFactors(bm);
      if (mf !== undefined) {
        // TODO Check the following discussion on signs:
        // normSquared(mv) is defined as "scalarProduct(mv, reverse(mv))".
        // - "reverse" introduces a sign expression
        //   "flipSign(getGrade(bm)) & 2".
        // - "scalarProductMV" introduces "flipSign(productFlips(bm, bm)) & 1",
        //   which has the same truthiness as "flipSign(getGrade(bm)) & 2" in
        //   "scalarProduct".
        // These two cancel each other out, so there is no sign flip here.
        // (It actually looks like the reversion of one argument has been
        // added to the definition of normSquared precisely for the purpose
        // of cancelling the signs from the scalar product.)
        result.add0([...mf, val, val]);
      }
    });
    return result;
  }

  /** **This is only correct for versors!** */
  inverse(mv: MultiVector<T>): MultiVector<T> {
    const nSq = this.normSquared(mv).get0();
    if (nSq === undefined || nSq === 0) {
      throw `trying to invert vector ${mv} that is always null`;
    }
    return this.scale(this.ctx.invertFactor(nSq), mv);
  }

  extractGrade(grade: number, mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("extract" + grade);
    mv.forComponents((bm, val) => {
      if (getGrade(bm) == grade) {
        result.add(bm, [val]);
      }
    });
    return result;
  }

  plus(...mvs: MultiVector<T>[]): MultiVector<T> {
    const result = this.ctx.makeMultiVector("plus");
    for (const mv of mvs) {
      mv.forComponents((bm, val) => result.add(bm, [val]));
    }
    return result;
  }

  /** The core functionality for all kinds of products */
  private product2(kind: ProductKind, a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector(kind + "Prod");
    a.forComponents((bmA, valA) => b.forComponents((bmB, valB) => {
      if (!productSkip[kind](bmA, bmB)) {
        const mf = this.metricFactors(bmA & bmB);
        if (mf !== undefined) {
          const sign = flipSign(productFlips(bmA, bmB) & 1);
          result.add(bmA ^ bmB, [...sign, ...mf, valA, valB]);
        }
      }
    }));
    return result;
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  private product(kind: ProductKind, mvs: MultiVector<T>[]): MultiVector<T> {
    return mvs.length === 0
      ? this.ctx.makeMultiVector(kind + "1").add(0, [])
      : mvs.reduce((acc, mv) => this.product2(kind, acc, mv));
  }

  wedgeProduct(...mvs: MultiVector<T>[]): MultiVector<T> {
    return this.product("wedge", mvs);
  }

  geometricProduct(...mvs: MultiVector<T>[]): MultiVector<T> {
    return this.product("geom", mvs);
  }

  contractLeft(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2("contrL", a, b);
  }

  contractRight(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2("contrR", a, b);
  }

  dotProduct(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2("dot", a, b);
  }

  /**
   * Implementation returning a multivector that is actually a scalar.
   * (At most the scalar component is filled.)
   */
  scalarProductMV(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2("scalar", a, b);
  }

  /** Implementation returning an object of scalar type. */
  scalarProduct(a: MultiVector<T>, b: MultiVector<T>): Scalar<T> {
    const result = this.ctx.makeScalar("scalarProd");
    a.forComponents((bm, valA) => {
      const valB = b.get(bm);
      if (valB !== undefined) {
        const mf = this.metricFactors(bm);
        if (mf !== undefined) {
          const sign = flipSign(getGrade(bm) & 2);
          result.add0([...sign, ...mf, valA, valB]);
        }
      }
    });
    return result;
  }
}
