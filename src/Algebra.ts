import alphabetic from "./alphabetic";
import scalarOp from "./scalarOp";


type Optimization =
| "bitCount"
| "evalNumbers"
| "knownNormSq"
| "knownNormSqInInverse"
| "knownNormSqInNorm"
| "knownNormSqInNormalize"
| "lazy"
| "plusSingle"
| "regressiveDirect"
| "regressiveEuclidean"
| "sandwich_lr_iMetric0"
| "sandwich_lrMetric0"
| "sandwichCancel1"
| "sandwichCancel2"
| "scalarOp"
| "scale0"
| "singleEuclideanNorm"
| "singleEuclideanNormalize"
| "singleInverse"
| "skipZeroAdd"
| "skipZeroIter"
| "skipZeroOM"
| "sum"
| "times"
| "trustKnownSqNorm"

| "default"
;

const optimizations: Partial<Record<Optimization, boolean>> = {
  // bitCount: false,
  // evalNumbers: false,
  // knownNormSq: false,
  // knownNormSqInInverse: false,
  // knownNormSqInNorm: false,
  // knownNormSqInNormalize: false,
  // lazy: false,
  // plusSingle: false,
  // regressiveDirect: false,
  // regressiveEuclidean: false,
  // sandwich_lr_iMetric0: false,
  // sandwich_lrMetric0: false,
  // sandwichCancel1: false,
  // sandwichCancel2: false,
  // scalarOp: false,
  // scale0: false,
  // singleEuclideanNorm: false,
  // singleEuclideanNormalize: false,
  // singleInverse: false,
  // skipZeroAdd: false,
  // skipZeroIter: false,
  // skipZeroOM: false,
  // sum: false;
  // times: false,
  // trustKnownSqNorm: false,

  default: true,
};

export const optimize = (opt: Optimization): boolean =>
  optimizations[opt] ?? optimizations.default ?? false;

/**
 * Semantically a boolean, but for convenience any value.
 * Only its truthiness should be used.
 */
export type truth = unknown;

export function fail(msg: string): never { throw new Error(msg); };

export type Scalar<T> = number | T;

export interface BackEnd<T> {
  scalarOp(name: string, args: Scalar<T>[], options?: {nameHint?: string}): Scalar<T>;
  comment?(text: string): void;
}

export class Multivector<T> implements Iterable<[number, Scalar<T>]> {
  #components: Scalar<T>[];
  readonly name: string;

  constructor(
    readonly alg: Algebra<T>,
    initialize: (
      add: (key: number | string, term: Scalar<T>) => unknown,
    ) => unknown,
    options?: {nameHint?: string},
  ) {
    const {nameHint = "aux"} = options ?? {};
    this.name = `${nameHint}_${alphabetic(alg.mvCount++)}`;
    alg.be.comment?.(`${this.name}`);
    // The outer array is indexed by component bitmaps,
    // the inner arrays are just lists:
    const componentTerms: Scalar<T>[][] = [];
    initialize((key, value) => {
      const bm = typeof key === "number" ? key : alg.stringToBitmap[key];
      (componentTerms[bm] ??= []).push(value);
    });
    this.#components = componentTerms.map((terms, bm) =>
      this.alg.sum(terms, {nameHint: this.name + "_" + alg.bitmapToString[bm]})
    );
  }

  value(key: number | string): Scalar<T> {
    const bm = typeof key === "number" ? key : this.alg.stringToBitmap[key];
    return this.#components[bm] ?? 0;
  }

  *[Symbol.iterator](): Iterator<[number, Scalar<T>]> {
    for (const [bitmap, value] of this.#components.entries()) {
      if (value === undefined) continue;
      if (optimize("skipZeroIter") && value === 0) continue;
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
    // // Debug code looking for multivectors with wrong #knownSqNorm:
    checkNormSq:
    if (!optimize("trustKnownSqNorm") && this.#knownSqNorm !== undefined) {
      let n2 = 0;
      for (const [bm, val] of this) {
        const mf = this.alg.metricFactors(bm);
        // Cannot check symbolic values at code-generation time:
        if (typeof mf !== "number" || typeof val !== "number") break checkNormSq;
        n2 += mf * val * val;
      }
      console.log("# norm squared: " + n2);
      if (Math.abs(n2 - this.#knownSqNorm) > 1e-10) {
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
  if (optimize("bitCount")) {
    // Kernighan method:
    while (bitmap) {
      bitmap &= bitmap - 1;
      result++;
    }
  } else {
    // Naive version:
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

  /** Return the metric factor for squaring a basis blade. */
  metricFactors(bm: number): Scalar<T> {
    return this.times(bitList(bm).map(i => this.metric[i]));
  }

  checkMine(mv: Multivector<T>): Multivector<T> {
    if (mv.alg !== this) fail("trying to use foreign multivector");
    return mv;
  }

  mv(obj: Record<string, Scalar<T>>, options?: {nameHint?: string}) {
    return new Multivector(this, add => {
      for (const [key, val] of Object.entries(obj)) {
        const bm = this.stringToBitmap[key] ??
          fail(`unexpected key in mv data: ${key}`);
        add(bm, val);
      }
    }, options);
  }

  vec(coords: Scalar<T>[], options?: {nameHint?: string}) {
    if (coords.length !== this.nDimensions) {
      fail(`vec expected ${this.nDimensions} coordinates but received ${coords.length}`);
    }
    return new Multivector(this, add => {
      coords.forEach((val, i) => add(1 << i, val));
    }, options);
  }

  zero(): Multivector<T> {
    return new Multivector(this, () => {}, {nameHint: "zero"});
  };
  one(): Multivector<T> {
    return new Multivector(this, add => add(0, 1), {nameHint: "#"}).withSqNorm(1);
  }
  /** `this.wedgeProduct(...this.basisVectors())` */
  pseudoScalar(): Multivector<T> {
    return new Multivector(this, add => add(this.fullBitmap, 1), {nameHint: "ps"})
      .withSqNorm(
        this.metric.every(factor => typeof factor === "number")
        ? (this.nDimensions & 2 ? -1 : 1)
          * this.metric.reduce((acc, factor) => acc * factor, 1)
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
        {nameHint: "basis_" + this.bitmapToString[bitmap]},
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
              if (optimize("skipZeroOM") && m_ij === 0) continue; // omit product with a factor 0
              const newFlips = bitCount(bitmapOut & ~(jBit - 1));
              recur(
                i + 1,
                bitmapOut | jBit,
                flips + newFlips,
                lazy(() => this.times([product(), m_ij])),
              );
            }
          }
        }

        recur(0, 0, 0, () => valueIn);
      }
    }, {nameHint: "morph"});
  }

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Scalar<T>, mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      if (!optimize("scale0") || alpha !== 0) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, this.times([alpha, value]));
        }
      }
    }, {nameHint: "scale"}).withSqNorm(
      mv.knownSqNorm !== undefined && typeof alpha === "number"
      ? mv.knownSqNorm * alpha
      : undefined
    );
  }

  negate(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.scalarOp("unaryMinus", [value]));
      }
    }, {nameHint: "negate"}).withSqNorm(mv.knownSqNorm);
  }

  gradeInvolution(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(gradeInvolutionFlips(bitmap), value));
      }
    }, {nameHint: "gradeInvolution"}).withSqNorm(mv.knownSqNorm);
  }

  reverse(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(reverseFlips(bitmap), value));
      }
    }, {nameHint: "reverse"}).withSqNorm(mv.knownSqNorm);
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
  normSquared(mv: Multivector<T>): Scalar<T> {
    this.checkMine(mv);
    if (optimize("knownNormSq") && mv.knownSqNorm !== undefined) return mv.knownSqNorm;

    // TODO If the entire multivector and the relevant metric factors
    // are given as numbers, precalculate the result.
    // (Is this TODO outdated?  Lower-level optimizations probably already
    // do this.  Check this.)

    return this.sum(
      [...mv].map(([bitmap, value]) =>
        this.times([this.metricFactors(bitmap), value, value])
      ),
      {nameHint: "normSquared"}
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
    if (optimize("knownNormSqInNorm") && knownSqNorm !== undefined) {
      // A slightly negative value might actually be 0 with a roundoff error.
      if (-1e8 < knownSqNorm && knownSqNorm < 0) knownSqNorm = 0;
      return Math.sqrt(knownSqNorm);
    }

    const se = this.singleEuclidean(mv);
    if (optimize("singleEuclideanNorm") && se !== null) {
      return this.scalarOp("abs", [mv.value(se)]);
    }

    return this.scalarOp("sqrt",
      // As in the [DFM07] reference implementation we floor the squared norm
      // to 0 to avoid problems when the squared norm is slightly below 0 due
      // to rounding errors.
      // Unfortunately this leaves actual errors undetected if the squared norm
      // is significantly below 0.
      // TODO Generate code catching slightly negative values as in the
      // optimized case above (using a scalar function "snapUpToZero")
      [this.scalarOp("max", [0, this.normSquared(mv)])]
    );
  }

  /** **This is only correct for versors!** */
  inverse(mv: Multivector<T>): Multivector<T> {
    this.checkMine(mv);
    if (optimize("knownNormSqInInverse") && mv.knownSqNorm === 1) return mv;

    // TODO provide nicer check for number of components
    if (optimize("singleInverse") && [...mv].length === 1) {
      return new Multivector(this, add => {
        for (const [bm, val] of mv) {
          const mf = this.metricFactors(bm) ||
            fail(`trying to invert null vector ${mv}`);
          add(
            bm,
            this.scalarOp("/", [reverseFlips(bm) ? -1 : +1, this.times([val, mf])]),
          );
        }
      }, {nameHint: "inverse"});
    }
    const norm2 = this.normSquared(mv) ||
      fail(`trying to invert null vector ${mv}`);
    return this.scale(this.scalarOp("/", [1, norm2]), this.reverse(mv));
  }

  /** **This is only correct for versors!** */
  normalize(mv: Multivector<T>): Multivector<T> {
    if (optimize("knownNormSqInNormalize") && mv.knownSqNorm === 1) return mv;

    const se = this.singleEuclidean(mv);
    if (optimize("singleEuclideanNormalize") && se !== null) {
      return new Multivector(this, add => {
        add(se, this.scalarOp("sign", [mv.value(se)]));
      }, {nameHint: "normSE"}).withSqNorm(1);
    }

    const normSq = this.normSquared(mv) ||
      fail(`trying to normalize null vector ${mv}`);
    return this.scale(
      this.scalarOp("inversesqrt",
        // Use the absolute value for compatibility with the
        // [DFM07] reference implementation.  Does it actually make sense?
        [true ? this.scalarOp("abs", [normSq]) : normSq]
      ),
      mv
    ).withSqNorm(1);
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
    }, {nameHint: "extract"});
  }

  extractGrade(grade: number, mv: Multivector<T>): Multivector<T> {
    return this.extract(bm => bitCount(bm) === grade, mv);
  }

  plus(...mvs: Multivector<T>[]): Multivector<T> {
    if (optimize("plusSingle") && mvs.length === 1) {
      return this.checkMine(mvs[0]);
    }
    return new Multivector(this, add => {
      for (const mv of mvs) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, value);
        }
      }
    }, {nameHint: "plus"});
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
    }, {nameHint: "minus"});
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
    }, {nameHint: include.name + "Prod"})
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
      ? new Multivector(this, add => add(0, 1), {nameHint: include + "1"})
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
      {nameHint: "scalarProd"}
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
    }, {nameHint: "regrProd"});
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
    }, {nameHint: "dual"});
  }

  /** like `.undual(mv)`, but pretending a Euclidean metric. */
  euclideanUndual(mv: Multivector<T>) {
    // TODO negate only for certain values of mv.alg.nDimensions?
    // (Perhaps only for 2, 3, 6, 7, 10, 11, ...?)
    // We should actually run tests with several algebra dimensionalities.
    return this.negate(this.euclideanDual(mv));
  }

  regressiveProduct(...mvs: Multivector<T>[]): Multivector<T> {
    if (optimize("regressiveDirect")) {
      return mvs.length === 0
        ? this.pseudoScalar()
        : mvs.reduce((acc, mv) => this.regressiveProduct2(acc, mv));
    } else if (optimize("regressiveEuclidean")) {
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
    } else {
      return this.undual(this.wedgeProduct(...mvs.map(mv => this.dual(mv))));
    }
  }

  /**
   * **EXPERIMENTAL!**
   * 
   * **EXPECTS A 2-BLADE AND POSITIVE-SEMIDEFINITE METRIC**
   */
  exp(A: Multivector<T>): Multivector<T> {
    // Notice that [DFM09] p. 185 use A**2, which is -norm2 for a 2-blade.
    const norm2 = this.normSquared(A);
    if (norm2 === 0) {
      return new Multivector(this, add => {
        add(0, 1);
        for (const [bitmap, value] of A) {
          add(bitmap, value);
        }
      }, {nameHint: "expNull"})
      // TODO refine:
      .withSqNorm([...A].every(([_, value]) => value === 0) ? 1 : undefined);
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const alpha = this.scalarOp("sqrt", [norm2]);
      const cos = this.scalarOp("cos", [alpha]);
      const sin = this.scalarOp("sin", [alpha]);
      const sinByAlpha = this.scalarOp("/", [sin, alpha]);
      return new Multivector(this, add => {
        add(0, cos);
        for (const [bitmap, value] of A) {
          add(bitmap, this.times([sinByAlpha, value]));
        }
      }, {nameHint: "exp"}).withSqNorm(1); // this is even correct with a non-Euclidean metric
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
    const scalarFactor = this.scalarOp("/", [atan, R2Norm]);
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
    ]);
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
    const scale = this.scalarOp("/", [1, this.scalarOp("sin", [Omega])]);
    return (t: Scalar<T>) => {
      const scaleA = this.times([scale,
        this.scalarOp("sin", [this.times([this.scalarOp("-", [1, t]), Omega])])
      ]);
      const scaleB = this.times([scale,
        this.scalarOp("sin", [this.times([t                       , Omega])])
      ]);
      return (
        this.plus(this.scale(scaleA, a), this.scale(scaleB, b))
        // knownSqNorm is not necessarily propagated by the lower-level operations:
        .withSqNorm(
          a.knownSqNorm !== b.knownSqNorm
          ? undefined
          : a.knownSqNorm
        )
      );
    }
  }

  // TODO similar optimizations for other scalar operators/functions
  times(args: Scalar<T>[]): Scalar<T> {
    if (!optimize("times")) {
      return this.scalarOp("*", [1, ...args]);
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
    return this.scalarOp("*", simplified);
  }

  sum(args: Scalar<T>[], options?: {nameHint?: string}): Scalar<T> {
    if (!optimize("sum")) {
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
    return this.scalarOp("+", simplified, options);
  }

  flipIf(condition: truth, value: Scalar<T>): Scalar<T> {
    return condition ? this.scalarOp("unaryMinus", [value]) : value;
  }

  scalarOp(name: string, args: Scalar<T>[], options?: {nameHint?: string}): Scalar<T> {
    return (
      optimize("scalarOp") && args.every(arg => typeof arg === "number")
      ? scalarOp(name, args)
      : this.be.scalarOp(name, args, options)
    );
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
        if (optimize("sandwich_lrMetric0") && lrMetric === 0) continue;

        const lrKey = [lBitmap, rBitmap].sort((x, y) => x - y).join(",");
        const lrVal = lrVals[lrKey] ??=
          lazy(() => this.times([lVal, lrMetric, rVal]));

        const lrBitmap = lBitmap ^ rBitmap;
        for (const iBitmap of componentBitmaps) {
          const lr_iMetric = this.metricFactors(lrBitmap & iBitmap);
          if (optimize("sandwich_lr_iMetric0") && lr_iMetric === 0) continue;

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
            !optimize("sandwichCancel1") || count != 0
            // TODO Construct an example where the laziness of term avoids
            // generating some superfluous code.  (Or remove the laziness.)
            ? [this.times([count, term()])]
            : []
          ),
          {nameHint: `matrix_${from}_${to}`}
        );
        if (!optimize("sandwichCancel2") || entry !== 0) {
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
            `sandwich-operand component "${this.bitmapToString[iBitmap]
            }" missing in component list`
          );
          cache1.forEach((cache2, lirBitmap) => {
            add(lirBitmap, this.times([cache2.entry, iVal]));
          });
        }
      }, {nameHint: "sandwich"}).withSqNorm(
        operator.knownSqNorm === undefined || operand.knownSqNorm === undefined
        ? undefined
        : operator.knownSqNorm * operand.knownSqNorm
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
      done = optimize("lazy") && true;
    }
    return result;
  }
}
