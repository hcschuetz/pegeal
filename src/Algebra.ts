import alphabetic from "./alphabetic";
import scalarOp from "./scalarOp";


const flagDefault = true;
const config = {
  beLazy: flagDefault,
  bitCountMode: "kernighan" as "naive" | "kernighan",
  checkScalarOp: flagDefault,
  epsilon: 1e-10,
  optimizeSingleArgPlus: flagDefault,
  optimizeSingleArgumentSum: flagDefault,
  optimizeSingleArgumentTimes: flagDefault,
  optimizeSingleComponentInverse: flagDefault,
  optimizeSingleEuclideanInNorm: flagDefault,
  optimizeSingleEuclideanInNormalize: flagDefault,
  optimizeSum: flagDefault,
  optimizeTimes: flagDefault,
  precomputeScalarOp: flagDefault,
  regressive: "direct" as "direct" | "euclidean" | "dual",
  setKnownSqNorm: flagDefault,
  skipZeroInOM: flagDefault,
  skipZeroIter: flagDefault,
  skipZeroSandwich_lr_iMetric: flagDefault,
  skipZeroSandwich_lrMetric: flagDefault,
  skipZeroSandwichMatrix1: flagDefault,
  skipZeroSandwichMatrix2: flagDefault,
  slerpDirect: flagDefault,
  trustKnownSqNorm: flagDefault,
  useKnownNormSq: flagDefault,
  useKnownNormSqInInverse: flagDefault,
  useKnownNormSqInNorm: flagDefault,
  useKnownNormSqInNormalize: flagDefault,
};

/**
 * Semantically a boolean, but for convenience any value.
 * Only its truthiness should be used.
 */
export type truth = unknown;

export function fail(msg: string): never { throw new Error(msg); };

export type Scalar<T> = number | T;

/** Options for the back end when creating code for a scalar operation */
export type ScalarOpOptions = Partial<{
  /**
   * If provided, the result of a scalar operation is stored in a variable
   * and the returned expression just accesses the variable.
   * Otherwise the generated expression is returned (for inlining).
   */
  named: string,
}>

export interface BackEnd<T> {
  scalarOp(op: string, args: Scalar<T>[], options?: ScalarOpOptions): Scalar<T>;
  comment?(text: string): void;
}

/** Options for the Multivector constructor */
// This looks like ScalarOpOptions, but has different semantics right now
// and may diverge in the future.
export type MultivectorOptions = Partial<{
  /** If provided, use this string in the multivector name. */
  named: string,
}>

export class Multivector<T> implements Iterable<[number, Scalar<T>]> {
  #components: Scalar<T>[];
  readonly name: string;

  constructor(
    readonly alg: Algebra<T>,
    initialize: (
      add: (key: number | string, term: Scalar<T>) => unknown,
    ) => unknown,
    options?: MultivectorOptions,
  ) {
    this.name = `${options?.named ?? "mv"}_${alphabetic(alg.mvCount++)}`;
    alg.be.comment?.(`${this.name}`);
    // The outer array is indexed by component bitmaps,
    // the inner arrays are just lists:
    const componentTerms: Scalar<T>[][] = [];
    initialize((key, value) => {
      const bm = typeof key === "number" ? key : alg.stringToBitmap[key];
      (componentTerms[bm] ??= []).push(value);
    });
    this.#components = componentTerms.map((terms, bm) =>
      this.alg.sum(terms, {named: this.name + "_" + alg.bitmapToString[bm]})
    );
  }

  value(key: number | string): Scalar<T> {
    const bm = typeof key === "number" ? key : this.alg.stringToBitmap[key];
    return this.#components[bm] ?? 0;
  }

  *[Symbol.iterator](): Iterator<[number, Scalar<T>]> {
    for (const [bitmap, value] of this.#components.entries()) {
      if (value === undefined) continue;
      if (config.skipZeroIter && value === 0) continue;
      yield [bitmap, value];
    }
  }

  *basisBlades(): Iterable<number> {
    for (const [bitmap] of this) yield bitmap;
  }

  /** Do we know (at code-generation time) that this multivector has norm 1? */
  #knownSqNorm: number | undefined = undefined;
  public get knownSqNorm() {
    return this.#knownSqNorm;
  }
  public set knownSqNorm(value) {
    if (!config.setKnownSqNorm) return;

    // Debug code looking for multivectors with wrong #knownSqNorm:
    if (!config.trustKnownSqNorm && value !== undefined) checkNormSq: {
      let n2 = 0;
      for (const [bm, val] of this) {
        const mf = this.alg.metricFactors(bm);
        // Cannot check symbolic values at code-generation time:
        if (typeof mf !== "number" || typeof val !== "number") break checkNormSq;
        n2 += mf * val * val;
      }
      if (Math.abs(n2 - value) > config.epsilon) {
        fail("Wrong knownSqNorm detected");
      }
    }

    this.#knownSqNorm = value;
  }

  /** Fluent wrapper around `this.knownSqNorm = ...` */
  withSqNorm(value: number | undefined): Multivector<T> {
    this.knownSqNorm = value;
    return this;
  }

  toString() {
    return `${this.name} ${this.#knownSqNorm ? `[${this.#knownSqNorm}] ` : ""}{${
      this.#components.flatMap((value, bm) => {
        const key = this.alg.bitmapToString[bm];
        return value === 0 ? [] : [`${key}: ${value}`];
      }).join(", ")
    }}`;
  }
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
export function bitCount(bitmap: number) {
  let result = 0;
  if (config.bitCountMode === "kernighan") {
    while (bitmap) {
      bitmap &= bitmap - 1;
      result++;
    }
  } else {
    forBitmap(bitmap, () => result++);
  }
  return result;
}

/**
 * Test whether the product of two basis blades should be included in a
 * multivector product.
 * 
 * Instances of this function type should have a name that is suitable as an
 * identifier.
 */
type ProdInclusionTest = (bmA: number, bmB: number) => truth;

// For each product kind a test whether the product of two basis blades
// (represented as bitmaps) should be included in the product.
const incl: Record<string, ProdInclusionTest> = {
  geom  : (        ) => true,
  wedge : (bmA, bmB) => !(bmA & bmB),
  contrL: (bmA, bmB) => !(bmA & ~bmB),
  contrR: (bmA, bmB) => !(~bmA & bmB),
  scalar: (bmA, bmB) => bmA === bmB,
  // ...or, to emphasize the analogy to wedge:
  //                    !(bmA ^ bmB)
  // ...or, to emphasize the analogy to dot:
  //                    !(bmA & ~bmB) && !(~bmA & bmB)
  dot   : (bmA, bmB) => !(bmA & ~bmB) || !(~bmA & bmB),
}

/**
 * The number of adjacent transpositions needed for the product of
 * two basis blades (represented as bitmaps).
 */
export function productFlips(bitmapA: number, bitmapB: number): number {
  let bCount = 0, flips = 0;
  for (let bit = 1; bit <= bitmapA; bit <<= 1) {
    if (bit & bitmapA) flips += bCount;
    if (bit & bitmapB) bCount++;
  }
  return flips;
}

export function gradeInvolutionFlips(bitmap: number): number {
  return bitCount(bitmap) & 1;
}

export function reverseFlips(bitmap: number): number {
  return (bitCount(bitmap) >> 1) & 1;
}

export class Algebra<T> {
  readonly nDimensions: number;
  readonly fullBitmap: number;
  readonly stringToBitmap: Record<string, number> = {};
  mvCount = 0;

  constructor(
    readonly metric: Scalar<T>[],
    readonly be: BackEnd<T>,
    readonly bitmapToString: string[],
  ) {
    const nDimensions = this.nDimensions = metric.length;
    this.fullBitmap = (1 << nDimensions) - 1;

    if (bitmapToString.length !== 1 << nDimensions) {
      fail("sizes of metric and component names do not fit");
    }
    bitmapToString.forEach((name, bm) => {
      if (this.stringToBitmap[name]) fail(`duplicate basis-blade name "${name}"`);
      this.stringToBitmap[name] = bm;
    });
  }

  /** Return the (inlined) product of metric factors for squaring a basis blade. */
  metricFactors(bm: number): Scalar<T> {
    return this.times(bitList(bm).map(i => this.metric[i]));
  }

  checkMine(mv: Multivector<T>): Multivector<T> {
    if (mv.alg !== this) fail("trying to use foreign multivector");
    return mv;
  }

  mv(obj: Record<string, Scalar<T>>, options?: MultivectorOptions) {
    return new Multivector(this, add => {
      for (const [key, val] of Object.entries(obj)) {
        const bm = this.stringToBitmap[key] ??
          fail(`unexpected key in mv data: ${key}`);
        add(bm, val);
      }
    }, options);
  }

  vec(coords: Scalar<T>[], options?: MultivectorOptions) {
    if (coords.length !== this.nDimensions) {
      fail(`vec expected ${this.nDimensions} coordinates but received ${coords.length}`);
    }
    return new Multivector(this, add => {
      coords.forEach((val, i) => add(1 << i, val));
    }, options);
  }

  zero(): Multivector<T> {
    return new Multivector(this, () => {}, {named: "zero"});
  };
  one(): Multivector<T> {
    return new Multivector(this, add => add(0, 1), {named: "one"}).withSqNorm(1);
  }
  /** `this.wedgeProduct(...this.basisVectors())` */
  pseudoScalar(): Multivector<T> {
    return new Multivector(this, add => add(this.fullBitmap, 1), {named: "ps"})
      .withSqNorm(
        this.metric.every(factor => typeof factor === "number")
        ? this.metric.reduce((acc, factor) => acc * factor, 1)
        : undefined
      );
  }
  pseudoScalarInv(): Multivector<T> {
    return this.inverse(this.pseudoScalar());
  }
  basisVectors(): Multivector<T>[] {
    return this.metric.map((factor, i) => {
      const bitmap = 1 << i;
      return new Multivector(
        this,
        add => add(bitmap, 1),
        {named: "basis_" + this.bitmapToString[bitmap]},
      ).withSqNorm(typeof factor === "number" ? factor : undefined)
    });
  }

  outermorphism(matrix: (Scalar<T> | undefined)[][], mv: Multivector<T>): Multivector<T> {
    // See `../doc/Outermorphism.md` for explanations.
    return new Multivector(this, add => {
      // no `this.checkMine(mv)` here as `mv` may actually come from elsewhere
      for (const [bitmapIn, valueIn] of mv) {
        const recur = (
          i: number,
          bitmapOut: number,
          flips: number,
          product: () => Scalar<T>,
        ) => {
          const iBit = 1 << i;
          if (iBit > bitmapIn) {
            // Fully traversed bitmapIn.  Contribute to the output:
            add(bitmapOut, this.flipIf(flips & 1, product()));
          } else if (!(iBit & bitmapIn)) {
            // The i-th basis vector is not in bitmapIn.  Skip it:
            recur(i + 1, bitmapOut, flips, product);
          } else {
            // The i-th basis vector is in bitmapIn.
            // Iterate over the output basis vectors and recur for the
            // "appropriate ones":
            for (let j = 0; j < this.nDimensions; j++) {
              const jBit = 1 << j;
              if (jBit & bitmapOut) continue; // wedge prod with duplicate is 0
              const m_ij = (matrix[j] ?? [])[i] ?? 0;
              if (config.skipZeroInOM && m_ij === 0) continue; // omit product with a factor 0
              const newFlips = bitCount(bitmapOut & ~(jBit - 1));
              recur(
                i + 1,
                bitmapOut | jBit,
                flips + newFlips,
                lazy(() => this.times([product(), m_ij], {named: "omAux"})),
              );
            }
          }
        }

        recur(0, 0, 0, () => valueIn);
      }
    }, {named: "morph"});
  }

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Scalar<T>, mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.times([alpha, value]));
      }
    }, {named: "scale"}).withSqNorm(
      mv.knownSqNorm !== undefined && typeof alpha === "number"
      ? alpha * alpha * mv.knownSqNorm
      : undefined
    );
  }

  negate(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.scalarOp("unaryMinus", [value]));
      }
    }, {named: "negate"}).withSqNorm(mv.knownSqNorm);
  }

  gradeInvolution(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(gradeInvolutionFlips(bitmap), value));
      }
    }, {named: "gradeInvolution"}).withSqNorm(mv.knownSqNorm);
  }

  reverse(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(reverseFlips(bitmap), value));
      }
    }, {named: "reverse"}).withSqNorm(mv.knownSqNorm);
  }

  dual(mv: Multivector<T>): Multivector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
    // TODO Implement directly?
  }

  undual(mv: Multivector<T>): Multivector<T> {
    return this.contractLeft(mv, this.pseudoScalar());
    // TODO Implement directly?
  }

  /**
   * Short for `this.scalarProduct(mv, this.reverse(mv))`.
   */
  // The signs introduced by `reverse` and `scalarProduct` cancel each
  // other out.  Thus there are no sign flips here.
  // (It looks like the `reverse` operation is in the definition of
  // normSquared precisely for this purpose.)
  normSquared(mv: Multivector<T>, options?: ScalarOpOptions): Scalar<T> {
    this.checkMine(mv);
    if (config.useKnownNormSq && mv.knownSqNorm !== undefined) return mv.knownSqNorm;

    return this.sum(
      [...mv].map(([bitmap, value]) =>
        this.times([this.metricFactors(bitmap), value, value])
      ),
      {named: "normSquared", ...options}
    );
  }

  /**
   * "Single euclidean" means that
   * - the multivector has precisely one basis blade that might be non-zero
   * - and the metric factors for this basis blade are all one.
   *   (Notice that it is not required that the entire metric is euclidean.)
   * 
   * The method returns the bitmap for that single basis blade or `null`
   * if the conditions above are not met.
   * 
   * Use this for to simplify/optimize 
   */
  protected singleEuclidean(mv: Multivector<T>): number | null {
    let foundBlade: number | null = null;
    for (const [bitmap, value] of this.checkMine(mv)) {
      if (value === 0) continue;
      if (foundBlade !== null) return null;
      foundBlade = bitmap;
      for (const i of bitList(bitmap)) {
        if (this.metric[i] !== 1) return null;
      }
    }
    return foundBlade;
  }

  norm(mv: Multivector<T>): Scalar<T> {
    this.checkMine(mv);

    let {knownSqNorm} = mv;
    if (config.useKnownNormSqInNorm && knownSqNorm !== undefined) {
      // A slightly negative value might actually be 0 with a roundoff error.
      if (-config.epsilon < knownSqNorm && knownSqNorm < 0) knownSqNorm = 0;
      return Math.sqrt(knownSqNorm);
    }

    if (config.optimizeSingleEuclideanInNorm) {
      const se = this.singleEuclidean(mv);
      if (se !== null) {
        return this.scalarOp("abs", [mv.value(se)], {named: "normSE"});
      }
    }

    return this.scalarOp("sqrt",
      // As in the [DFM07] reference implementation we floor the squared norm
      // to 0 to avoid problems when the squared norm is slightly below 0 due
      // to rounding errors.
      // Unfortunately this leaves actual errors undetected if the squared norm
      // is significantly below 0.
      // TODO Generate code catching slightly negative values as in the
      // optimized case above (using a scalar function "snapUpToZero")
      [this.scalarOp("max", [0, this.normSquared(mv)])],
      {named: "norm"}
    );
  }

  /** **This is only correct for versors!** */
  inverse(mv: Multivector<T>): Multivector<T> {
    this.checkMine(mv);
    if (config.useKnownNormSqInInverse && mv.knownSqNorm === 1) return this.reverse(mv);

    // TODO provide nicer check for number of components
    if (config.optimizeSingleComponentInverse && [...mv].length === 1) {
      return new Multivector(this, add => {
        for (const [bm, val] of mv) {
          const mf = this.metricFactors(bm) ||
            fail(`trying to invert null vector ${mv}`);
          add(
            bm,
            this.scalarOp("/", [reverseFlips(bm) ? -1 : +1, this.times([val, mf])]),
          );
        }
      }, {named: "inverse"});
    }
    const norm2 = this.normSquared(mv) ||
      fail(`trying to invert null vector ${mv}`);
    return this.scale(this.scalarOp("/", [1, norm2], {named: "inverse"}), this.reverse(mv));
  }

  /** **This is only correct for versors!** */
  normalize(mv: Multivector<T>): Multivector<T> {
    if (config.useKnownNormSqInNormalize && mv.knownSqNorm === 1) return mv;

    if (config.optimizeSingleEuclideanInNormalize) {
      const se = this.singleEuclidean(mv);
      if (se !== null) {
        return new Multivector(this, add => {
          add(se, this.scalarOp("sign", [mv.value(se)]));
        }, {named: "normalizeSE"}).withSqNorm(1);
      }
    }

    const normSq = this.normSquared(mv) ||
      fail(`trying to normalize null vector ${mv}`);

    return this.scale(
      this.scalarOp("inversesqrt", [
        // Using the absolute value as in the [DFM07] reference implementation
        // so that we can also "normalize" multivectors squaring to a negative
        // value (e.g. bivectors with a Euclidean metric):
        this.scalarOp("abs", [normSq]),
      ], {named: "normalizationFactor"}),
      mv
    ).withSqNorm(typeof normSq === "number" ? Math.sign(normSq) : undefined);
    // TODO Write a test case that succeeds with `Math.sign(normSq)` but fails
    // if it is replaced with `1`.
  }

  extract(
    test: (bm: number, value: Scalar<T>) => boolean,
    mv: Multivector<T>,
  ): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (test(bitmap, value)) {
          add(bitmap, value);
        }
      }
    }, {named: "extract"});
  }

  extractGrade(grade: number, mv: Multivector<T>): Multivector<T> {
    return this.extract(bm => bitCount(bm) === grade, mv);
  }

  plus(...mvs: Multivector<T>[]): Multivector<T> {
    if (config.optimizeSingleArgPlus && mvs.length === 1) {
      return this.checkMine(mvs[0]);
    }
    return new Multivector(this, add => {
      for (const mv of mvs) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, value);
        }
      }
    }, {named: "plus"});
  }

  /**
   * Subtract a multivector from another one.
   */
  minus(pos: Multivector<T>, neg: Multivector<T>) {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(pos)) {
        add(bitmap, value);
      }
      for (const [bitmap, value] of this.checkMine(neg)) {
        add(bitmap, this.scalarOp("unaryMinus", [value]));
      }
    }, {named: "minus"});
  }

  /** The core functionality for all kinds of products */
  product2(include: ProdInclusionTest, a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    this.checkMine(a);
    this.checkMine(b);
    let skipped = false;
    return new Multivector(this, add => {
      for (const [bmA, valA] of a) {
        for (const [bmB, valB] of b) {
          if (include(bmA, bmB)) {
            const mf = this.metricFactors(bmA & bmB);
            const flip = productFlips(bmA, bmB) & 1;
            add(bmA ^ bmB, this.flipIf(flip, this.times([mf, valA, valB])));
          } else {
            skipped = true;
          }
        }
      }
    }, {named: include.name + "Prod"})
    .withSqNorm(
      skipped || a.knownSqNorm === undefined || b.knownSqNorm === undefined
      ? undefined
      : a.knownSqNorm * b.knownSqNorm
    );
    // We do not  restrict "sqared-norm propagation" to geometric products.
    // It suffices if the product happens to behave like a geometric product
    // for the given input vectors (i.e., no skipped component pairs).
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  product(include: ProdInclusionTest, mvs: Multivector<T>[]): Multivector<T> {
    return mvs.length === 0
      ? new Multivector(this, add => add(0, 1), {named: include + "1"})
        .withSqNorm(1)
      : mvs.reduce((acc, mv) => this.product2(include, acc, mv));
  }

  wedgeProduct(...mvs: Multivector<T>[]): Multivector<T> {
    return this.product(incl.wedge, mvs);
  }

  geometricProduct(...mvs: Multivector<T>[]): Multivector<T> {
    return this.product(incl.geom, mvs);
  }

  contractLeft(a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    return this.product2(incl.contrL, a, b);
  }

  contractRight(a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    return this.product2(incl.contrR, a, b);
  }

  dotProduct(a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    return this.product2(incl.dot, a, b);
  }

  /**
   * Implementation returning a multivector that is actually a scalar.
   * (At most the scalar component is filled.)
   */
  scalarProductMV(a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    return this.product2(incl.scalar, a, b);
  }

  /** Implementation returning an object of scalar type. */
  scalarProduct(a: Multivector<T>, b: Multivector<T>): Scalar<T> {
    this.checkMine(a);
    this.checkMine(b);
    return this.sum(
      [...a].map(([bitmap, valA]) => {
        const valB = b.value(bitmap);
        const mf = this.metricFactors(bitmap);
        // Notice that reverseFlips(bitmap) === productFlips(bitmap, bitmap) & 1:
        return this.flipIf(reverseFlips(bitmap), this.times([mf, valA, valB]));
      }),
      {named: "scalarProd"}
    )
  }

  // The regressive product does not fully fit into the pattern of
  // `this.product2(...)`.  We could generalize `product2`, but the extra
  // complexity needed there appears not to be worthwhile.  So we have a
  // specialized implementation here:
  protected regressiveProduct2(a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    this.checkMine(a);
    this.checkMine(b);
    const {fullBitmap} = this;
    return new Multivector(this, add => {
      for (const [bmA, valA] of a) {
        const bmACompl = fullBitmap ^ bmA;
        for (const [bmB, valB] of b) {
          const bmBCompl = fullBitmap ^ bmB;
          if (!(bmACompl & bmBCompl)) {
            // The regressive product is non-metric (like the wedge product).
            // So we need no metric factors.
            const flip = productFlips(bmACompl, bmBCompl) & 1;
            add(bmA & bmB, this.flipIf(flip, this.times([valA, valB])));
          }
        }
      }
    }, {named: "regrProd"});
    // TODO Set knownSqNorm when possible
  }

  /** like `.dual(mv)`, but pretending a Euclidean metric. */
  euclideanDual(mv: Multivector<T>) {
    this.checkMine(mv);
    const {fullBitmap} = this;
    return new Multivector(this, add => {
      for (const [bm, val] of mv) {
        const flips = productFlips(bm ^ fullBitmap, fullBitmap);
        add(bm ^ fullBitmap, this.flipIf(flips & 1, val));
      }
    }, {named: "dual"});
  }

  /** like `.undual(mv)`, but pretending a Euclidean metric. */
  euclideanUndual(mv: Multivector<T>) {
    // TODO negate only for certain values of mv.alg.nDimensions?
    // (Perhaps only for 2, 3, 6, 7, 10, 11, ...?)
    // We should actually run tests with several algebra dimensionalities.
    return this.negate(this.euclideanDual(mv));
  }

  regressiveProduct(...mvs: Multivector<T>[]): Multivector<T> {
    switch (config.regressive) {
      case "direct":
        return mvs.length === 0
        ? this.pseudoScalar()
        : mvs.reduce((acc, mv) => this.regressiveProduct2(acc, mv));
      case "euclidean":
        // If the pseudoscalar squares to 0 we cannot use `alg.dual(...)`, but
        // the regressive product works in that case as well since it is
        // actually non-metric.  So we can use a duality based on any metric.
        // The most straight-forward choice is the Euclidean metric.
        // (See also [DFM09], p. 135, last paragraph, where the same idea is
        // explained for the `meet` operation, which is closely related to the
        // regressive product.)
        return this.euclideanUndual(this.wedgeProduct(
          ...mvs.map(mv => this.euclideanDual(mv))
        ));
      case "dual":
        return this.undual(this.wedgeProduct(...mvs.map(mv => this.dual(mv))));
      default:
        fail("unexpected config for regressive product: " +  config.regressive);
    }
  }

  /**
   * **EXPERIMENTAL!**
   * 
   * **EXPECTS A 2-BLADE AND POSITIVE-SEMIDEFINITE METRIC**
   */
  exp(A: Multivector<T>): Multivector<T> {
    // Notice that [DFM09] p. 185 use A**2, which is -norm2 for a 2-blade.
    // TODO use this.norm(...) to make proper use of the "singleEuclidean"
    // optimization.  (Currently a single Euclidean component is squared and
    // then the square root is taken)
    const alpha = this.norm(A);
    if (alpha === 0) {
      return new Multivector(this, add => {
        add(0, 1);
        for (const [bitmap, value] of A) {
          add(bitmap, value);
        }
      }, {named: "expNull"})
      // TODO refine:
      .withSqNorm([...A].every(([_, value]) => value === 0) ? 1 : undefined);
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const cos = this.scalarOp("cos", [alpha]);
      const sin = this.scalarOp("sin", [alpha]);
      const sinByAlpha = this.scalarOp("/", [sin, alpha], {named: "sinByAlpha"});
      return new Multivector(this, add => {
        add(0, cos);
        for (const [bitmap, value] of A) {
          add(bitmap, this.times([sinByAlpha, value]));
        }
      }, {named: "exp"}).withSqNorm(1); // this is even correct with a non-Euclidean metric
    }
  }

  /** **EXPECTS A 3-D ROTOR** */
  // See [DFM09] p. 259.
  //
  // TODO Does this really only work in 3-D?  Doesn't it suffice that the rotor
  // is "exp(some 2-blade)", even in higher dimensions or 2-D?
  // 
  // Notice that in 3D R can also be seen as a unit quaternion,
  // except that the xz component is the *negative* j component.
  log(R: Multivector<T>): Multivector<T> {
    /** The cosine of the half angle, that is, the real part of the quaternion */
    const R0 = R.value(0);
    /** The imaginary part of the quaternion */
    const R2 = this.extractGrade(2, R);
    /** The sine of the half angle */
    const R2Norm = this.norm(R2) || fail("division by zero in log computation");
    // TODO optimize away atan2 call if R0 == 0.
    const atan = this.scalarOp("atan2", [R2Norm, R0]);
    const scalarFactor = this.scalarOp("/", [atan, R2Norm], {named: "scaledAngle"});
    return this.scale(scalarFactor, R2);
  }

  // ----------------------------------------------------
  // Utilities (TODO Separate them from the core methods?)

  dist(a: Multivector<T>, b: Multivector<T>): Scalar<T> {
    return this.norm(this.minus(a, b));
  }
  
  /** **EXPECTS 1-VECTORS** */
  getAngle(a: Multivector<T>, b: Multivector<T>): Scalar<T> {
    return this.scalarOp("atan2", [
      this.norm(this.wedgeProduct(a, b)),
      this.scalarProduct(a, b),
    ], {named: "angle"});
  }

  /**
   * Spherical linear interpolation
   * 
   * The two arguments should be linearly independent 1-vectors.
   * (TODO Support the case that they point in the same direction.
   * When pointing in opposite directions, select an arbitrary arc?)
   * 
   * For interpolation on a circle arc the two input vectors should have
   * the same magnitude, namely the circle's radius.
   */
  slerp(a: Multivector<T>, b: Multivector<T>) {
    const Omega = this.getAngle(a, b);
    const scale = this.scalarOp("/", [1, this.scalarOp("sin", [Omega])], {named: "slerpScale"});
    return (t: Scalar<T>) => {
      const scaleA = this.times([scale,
        this.scalarOp("sin", [this.times([this.scalarOp("-", [1, t]), Omega])])
      ], {named: "weight"});
      const scaleB = this.times([scale,
        this.scalarOp("sin", [this.times([t                         , Omega])])
      ], {named: "weight"});
      return (
        config.slerpDirect
        ? new Multivector(this, add => {
            for (const [bm, val] of a) add(bm, this.times([val, scaleA]));
            for (const [bm, val] of b) add(bm, this.times([val, scaleB]));
          }, {named: "slerp"})
        : this.plus(this.scale(scaleA, a), this.scale(scaleB, b))
        )
        // knownSqNorm is generally not propagated by the lower-level operations:
        .withSqNorm(
          a.knownSqNorm !== b.knownSqNorm
          ? undefined
          : a.knownSqNorm
        );
    }
  }

  // TODO similar optimizations for other scalar operators/functions
  times(args: Scalar<T>[], options?: ScalarOpOptions): Scalar<T> {
    if (!config.optimizeTimes) {
      return this.scalarOp("*", [1, ...args], options);
    }
    let num = 1;
    const sym: T[] = [];
    for (const arg of args) {
      if (typeof arg === "number") {
        // This is not absolutely correct.  If one operator is 0 and another one
        // is NaN or infinity, the unoptimized computation would not return 0.
        // (But we are in "fast-math mode". ;-)
        if (arg === 0) return 0;
        num *= arg;
      } else {
        sym.push(arg);
      }
    }
    const simplified: Scalar<T>[] =
      // TODO If num === -1, use unary minus?
      num !== 1 || sym.length === 0 ? [...sym, num] : sym;
    if (config.optimizeSingleArgumentTimes && !options?.named && simplified.length === 1) {
      return simplified[0];
    }
    return this.scalarOp("*", simplified, options);
  }

  sum(args: Scalar<T>[], options?: ScalarOpOptions): Scalar<T> {
    if (!config.optimizeSum) {
      return this.scalarOp("+", [0, ...args], options);
    }
    let num = 0;
    const sym: T[] = [];
    for (const arg of args) {
      if (typeof arg === "number") {
        num += arg;
      } else {
        sym.push(arg);
      }
    }
    const simplified: Scalar<T>[] =
      num !== 0 || sym.length === 0 ? [...sym, num] : sym;
    if (config.optimizeSingleArgumentSum && !options?.named && simplified.length === 1) {
      return simplified[0];
    }
    return this.scalarOp("+", simplified, options);
  }

  flipIf(condition: truth, value: Scalar<T>): Scalar<T> {
    return condition ? this.scalarOp("unaryMinus", [value]) : value;
  }

  scalarOp(op: string, args: Scalar<T>[], options?: ScalarOpOptions): Scalar<T> {
    if (config.checkScalarOp) {
      Algebra.checkScalarOp(op, args);
    }
    return (
      config.precomputeScalarOp && args.every(arg => typeof arg === "number")
      ? scalarOp(op, args)
      : this.be.scalarOp(op, args, options)
    );
  }

  /**
   * Define which scalar operations are expected to be supported.
   * 
   * If this check fails, there is a problem on the algebra level.
   * If this check succeeds and the back end fails, there is a problem
   * with the back end.
   * (Or there is a problem with this check...)
   */
  static checkScalarOp<T>(op: string, args: Scalar<T>[]): void {
    const arity = args.length;
    let ok: boolean;
    switch (op) {
      case "+":
      case "*":
      case "max":
        ok = arity >= 1; break;
      case "-":
      case "/":
      case "atan2":
        ok = arity === 2; break;
      case "abs":
      case "cos":
      case "inversesqrt":
      case "sign":
      case "sin":
      case "sqrt":
      case "unaryMinus":
        ok = arity === 1; break;
      default:
        fail(`Unexpected scalar operation "${op}"`);
    }
    if (!ok) {
      fail(`Unexpected number of arguments for scalar operation "${op}": ${arity}`);
    }
  }

  /**
   * `sandwich(operator, operandComponents)(operand)` is like
   * `this.geometricProduct(operator, operand, this.reverse(operator))`
   * but cancels terms that can be detected at code-generation time
   * to be negations of each other.
   * 
   * The `operator` is typically a unit versor for a mirror/rotation operation
   * without stretching/shrinking.
   * 
   * The function is curried so that the same `operator` can be "applied" to
   * multiple `operand`s, pre-computing and sharing some intermediate values
   * that do not depend on the `operand`'s component magnitudes.
   * 
   * `operandComponents` tells which components might be populated in the
   * `operand`s.  It is an iterable of bitmaps and/or basis-blade names.
   */
  sandwich(
    operator: Multivector<T>,
    operandComponents: Iterable<number | string>,
  ): (operand: Multivector<T>) => Multivector<T> {
    this.checkMine(operator);

    const componentBitmaps = [...operandComponents].map(x =>
      typeof x === "number"
      ? (x >= 1 << this.nDimensions && fail(`bitmap exceeds limit: ${x}`), x)
      : this.stringToBitmap[x] ?? fail(`unknown basis blade: "${x}"`)
    );

    // Prefixes l/i/r refer to the left/inner/right parts of a sandwich.

    const lrVals: Record<string, () => Scalar<T>> = {};

    // cache[iBitmap][lirBitmap].children[lrKey] has shape {count, term}.
    // The (linear) mapping from the operand to the result multivector is
    // represented by a matrix with entries `cache[iBitmap][lirBitmap].entry`.
    const cache: Array<Array<{
      children: Record<string, {
        count: number,
        term: () => Scalar<T>,
      }>,
      entry: Scalar<T>;
    }>> = [];

    for (const [lBitmap, lVal] of operator) {
      for (const [rBitmap, rVal] of operator) {
        const lrMetric = this.metricFactors(lBitmap & rBitmap);
        if (config.skipZeroSandwich_lrMetric && lrMetric === 0) continue;

        const lrKey = [lBitmap, rBitmap].sort((x, y) => x - y).join(",");
        const lrVal = lrVals[lrKey] ??=
          lazy(() => this.times([lVal, lrMetric, rVal], {named: "lrVal"}));

        const lrBitmap = lBitmap ^ rBitmap;
        for (const iBitmap of componentBitmaps) {
          const lr_iMetric = this.metricFactors(lrBitmap & iBitmap);
          if (config.skipZeroSandwich_lr_iMetric && lr_iMetric === 0) continue;

          const liBitmap = lBitmap ^ iBitmap;
          const lirBitmap = liBitmap ^ rBitmap;

          const cache1 = cache[iBitmap] ??= [];
          const cache2 = cache1[lirBitmap] ??= {children: {}, entry: 0};
          const cache3 = cache2.children[lrKey] ??= {
            count: 0,
            term: lazy(() => this.times([lrVal(), lr_iMetric])),
          };

          const flips =
            productFlips(lBitmap, iBitmap)
          + productFlips(liBitmap, rBitmap)
          + reverseFlips(rBitmap);
          cache3.count += flips & 1 ? -1 : 1;
        }
      }
    }

    // Pre-compute matrix entries:
    cache.forEach((cache1, iBitmap) => {
      cache1.forEach((cache2, lirBitmap) => {
        const from = this.bitmapToString[iBitmap];
        const to   = this.bitmapToString[lirBitmap];
        const entry = this.sum(
          Object.values(cache2.children).flatMap(({count, term}) =>
            !config.skipZeroSandwichMatrix1 || count != 0
            // TODO Construct an example where the laziness of term avoids
            // generating some superfluous code.  (Or remove the laziness.)
            ? [this.times([count, term()])]
            : []
          ),
          {named: `matrix_${from}_${to}`}
        );
        if (!config.skipZeroSandwichMatrix2 || entry !== 0) {
          cache2.entry = entry;
        }
      });
    });

    return (operand) => {
      this.checkMine(operand);
      return new Multivector<T>(this, add => {
        // The remaining code is essentially a matrix/vector multiplication:
        for (const [iBitmap, iVal] of operand) {
          const cache1 = cache[iBitmap] ?? fail(
            `sandwich-operand component "${
              this.bitmapToString[iBitmap]
            }" missing in component list`
          );
          cache1.forEach((cache2, lirBitmap) => {
            add(lirBitmap, this.times([cache2.entry, iVal]));
          });
        }
      }, {named: "sandwich"}).withSqNorm(
        operator.knownSqNorm === undefined || operand.knownSqNorm === undefined
        ? undefined
        : operator.knownSqNorm * operator.knownSqNorm * operand.knownSqNorm
      );
    };
  }
}

function lazy<T>(exec: () => T): () => T {
  let result: T;
  let done = false;
  return () => {
    if (!done) {
      result = exec();
      done = config.beLazy && true;
    }
    return result;
  }
}
