import alphabetic from "./alphabetic";
import scalarOp from "./scalarOp";


type Optimization =
| "bitCount"
| "evalNumbers"
| "lazy"
| "plusSingle"
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
| "times"
| "unitInverse"
| "unitNormSq"
| "unitNorm"
| "unitNormalize"

| "default"
;

const optimizations: Partial<Record<Optimization, boolean>> = {
  // bitCount: false,
  // evalNumbers: false,
  // lazy: false,
  // plusSingle: false,
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
  // times: false,
  // unitInverse: false,
  // unitNorm: false,
  // unitNormalize: false,
  // unitNormSq: false,

  default: true,
};

export const optimize = (opt: Optimization): boolean =>
  optimizations[opt] ?? optimizations.default ?? false;

/**
 * Semantically a boolean, but for convenience any value.
 * Only its truthiness should be used.
 */
export type truth = unknown;

function fail(msg: string): never { throw new Error(msg); };

export type Scalar<T> = number | T;

/** A variable as provided by a `BackEnd` */
export interface BEVariable<T> {
  add(value: Scalar<T>): void;
  value(): Scalar<T>;
}

export interface BackEnd<T> {
  makeVar(nameHint: string): BEVariable<T>;
  scalarOp(name: string, ...args: Scalar<T>[]): Scalar<T>;
  comment?(text: string): void;
}

/**
 * A "smart" variable wrapping a back-end variable.
 * 
 * - Numbers are added separately from symbolic values (if this optimization is
 *   enabled).
 * - A back-end variable is only created as soon as a symbolic term is added.
 * - A "freezing" step between  `.add()` and `.value()` calls is required
 *   - to ensure that calls are in proper order and
 *   - to merge the number sum into the symbolic sum (the back-end variable).
 */
class Variable<T> {
  #beVar? : BEVariable<T>;
  #numericPart = 0;
  #frozen = false;

  constructor(
    private createBEVar: () => BEVariable<T>,
  ) {}

  add(value: Scalar<T>): void {
    if (this.#frozen) fail("trying to update frozen variable");

    if (optimize("evalNumbers") && typeof value === "number") {
      this.#numericPart += value;
    } else {
      (this.#beVar ??= this.createBEVar()).add(value);
    }
  }

  freeze(): void {
    if (this.#frozen) fail("trying to re-freeze a variable");

    if (this.#beVar && this.#numericPart !== 0) {
      this.#beVar.add(this.#numericPart);
    }
    this.#frozen = true;
  }

  value(): Scalar<T> {
    if (!this.#frozen) fail("trying to read non-frozen variable");

    return this.#beVar ? this.#beVar.value() : this.#numericPart;
  }
}

export class Multivector<T> implements Iterable<[number, Scalar<T>]> {
  #components: Variable<T>[] = [];
  readonly name: string;

  constructor(
    readonly alg: Algebra<T>,
    nameHint: string,
    initialize: (
      add: (bm: number, term: Scalar<T>) => unknown,
    ) => unknown,
  ) {
    this.name = `${nameHint}_${alphabetic(alg.mvCount++)}`;
    alg.be.comment?.(`${this.name}`);
    initialize((bm, value) => {
      // This optimization is not really needed.
      // Without it a Variable<T> might be created unnecessarily,
      // but still without a backing target-language variable
      // (if that optimization is enabled).
      if (optimize("skipZeroAdd") && value === 0) return;

      (this.#components[bm] ??=
        alg.makeVariable(this.name + "_" + alg.bitmapToString[bm])
      ).add(value);
    });
    this.#components.forEach(variable => variable.freeze());
  }

  value(bm: number): Scalar<T> { return this.#components[bm]?.value() ?? 0; }

  *[Symbol.iterator](): Iterator<[number, Scalar<T>]> {
    for (const [bitmap, variable] of this.#components.entries()) {
      if (variable === undefined) continue;
      const value = variable.value();
      if (optimize("skipZeroIter") && value === 0) continue;
      yield [bitmap, value];
    }
  }

  *basisBlades(): Iterable<number> {
    for (const [bitmap] of this) yield bitmap;
  }

  /** Do we know (at code-generation time) that this multivector has norm 1? */
  #knownUnit = false;
  public get knownUnit() {
    return this.#knownUnit;
  }
  public set knownUnit(mark) {
    // // Debug code looking for non-unit multivectors being marked as unit:
    // checkUnit:
    // if (mark) {
    //   let n2 = 0;
    //   for (const [bm, val] of this) {
    //     const mf = this.alg.metricFactors(bm);
    //     // Cannot check symbolic values here:
    //     if (typeof mf !== "number" || typeof val !== "number") break checkUnit;
    //     n2 += mf * val * val;
    //   }
    //   console.log("# UNIT: " + n2);
    //   // n2 ~ -1 is also allowed:
    //   if (Math.abs(Math.abs(n2) - 1) > 1e-10) {
    //     fail("Marking a non-unit multivector as unit");
    //   }
    // }

    this.#knownUnit = mark;
  }

  /** Fluent wrapper around `this.knownUnit = ...` */
  markAsUnit(mark: boolean = true): Multivector<T> {
    this.knownUnit = mark;
    return this;
  }

  toString() {
    return `${this.name} ${this.knownUnit ? "[unit] " : ""}{${
      this.#components
      .map((variable, bm) => `${this.alg.bitmapToString[bm]}: ${variable.value()}`)
      .filter(val => val)
      .join(", ")
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
type ProdInclusionTest = (bmA: number, bmB: number) => boolean;

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
      if (this.stringToBitmap[name]) fail(`duplicate base-blade name "${name}"`);
      this.stringToBitmap[name] = bm;
    });
  }

  makeVariable(nameHint: string): Variable<T> {
    return new Variable(() => this.be.makeVar(nameHint));
  }

  /** Create a scalar with an initialization function similar to a `Multivector` */
  makeScalar(name: string, init: (add: (value: Scalar<T>) => void) => void) {
    this.be.comment?.(name);
    const variable = this.makeVariable(name);
    init(value => variable.add(value));
    variable.freeze();
    return variable.value();
  }

  /** Return the metric factor for squaring a basis blade. */
  metricFactors(bm: number): Scalar<T> {
    return this.times(...bitList(bm).map(i => this.metric[i]));
  }

  checkMine(mv: Multivector<T>): Multivector<T> {
    if (mv.alg !== this) fail("trying to use foreign multivector");
    return mv;
  }

  mv(nameHint: string, obj: Record<string, Scalar<T>>) {
    return new Multivector(this, nameHint, add => {
      for (const [key, val] of Object.entries(obj)) {
        const bm = this.stringToBitmap[key] ??
          fail(`unexpected key in mv data: ${key}`);
        add(bm, val);
      }
    });
  }

  zero(): Multivector<T> {
    return new Multivector(this, "zero", () => {});
  };
  one(): Multivector<T> {
    return new Multivector(this, "one", add => add(0, 1)).markAsUnit();
  }
  pseudoScalar(): Multivector<T> {
    return new Multivector(this, "ps", add => add(this.fullBitmap, 1))
      .markAsUnit(this.metric.every(v => v === 1));
  }
  pseudoScalarInv(): Multivector<T> {
    return this.inverse(this.pseudoScalar());
  }
  basisVectors(): Multivector<T>[] {
    return this.metric.map((_, i) => {
      const bitmap = 1 << i;
      return new Multivector(
        this,
        "basis_" + this.bitmapToString[bitmap],
        add => add(bitmap, 1),
      ).markAsUnit(this.metric[i] === 1)
    });
  }

  outermorphism(matrix: (Scalar<T> | undefined)[][], mv: Multivector<T>): Multivector<T> {
    // See `../doc/Outermorphism.md` for explanations.
    return new Multivector(this, "morph", add => {
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
                lazy(() => this.times(product(), m_ij)),
              );
            }
          }
        }

        recur(0, 0, 0, () => valueIn);
      }
    });
  }

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Scalar<T>, mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "scale", add => {
      if (!optimize("scale0") || alpha !== 0) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, this.times(alpha, value));
        }
      }
    }).markAsUnit(
      mv.knownUnit &&
      (typeof alpha === "number" && Math.abs(alpha) === 1)
    );
  }

  negate(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "negate", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.scalarOp("unaryMinus", value));
      }
    }).markAsUnit(mv.knownUnit);
  }

  gradeInvolution(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "gradeInvolution", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(gradeInvolutionFlips(bitmap), value));
      }
    }).markAsUnit(mv.knownUnit);
  }

  reverse(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "reverse", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, this.flipIf(reverseFlips(bitmap), value));
      }
    }).markAsUnit(mv.knownUnit);
  }

  dual(mv: Multivector<T>): Multivector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
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
    if (optimize("unitNormSq") && mv.knownUnit) return 1; // TODO or -1?

    // TODO If the entire multivector and the relevant metric factors
    // are given as numbers, precalculate the result.

    return this.makeScalar("normSquared", add => {
      for (const [bitmap, value] of mv) {
        add(this.times(this.metricFactors(bitmap), value, value));
      }
    });
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
    if (optimize("unitNorm") && mv.knownUnit) return 1;

    const se = this.singleEuclidean(mv);
    if (optimize("singleEuclideanNorm") && se !== null) return this.scalarOp("abs", mv.value(se));

    return this.scalarOp("sqrt",
      // As in the [DFM07] reference implementation we floor the squared norm
      // to 0 to avoid problems when the squared norm is slightly below 0 due
      // to rounding errors.
      // Unfortunately this leaves actual errors undetected if the squared norm
      // is significantly below 0.
      // TODO Check for "truly" negative squared norm?
      // But how to do this in gernerated code?
      // Or just take the absolute value of `normSquared` (as in `normalize`)?
      this.scalarOp("max", 0, this.normSquared(mv))
    );
  }

  /** **This is only correct for versors!** */
  inverse(mv: Multivector<T>): Multivector<T> {
    this.checkMine(mv);
    if (optimize("unitInverse") && mv.knownUnit) return mv;
    // TODO provide nicer check for number of components
    if (optimize("singleInverse") && [...mv].length === 1) {
      return new Multivector(this, "inverse", add => {
        for (const [bm, val] of mv) {
          const mf = this.metricFactors(bm) ||
            fail(`trying to invert null vector ${mv}`);
          add(
            bm,
            this.scalarOp("/", reverseFlips(bm) ? -1 : +1, this.times(val, mf)),
          );
        }
      });
    }
    const norm2 = this.normSquared(mv) ||
      fail(`trying to invert null vector ${mv}`);
    return this.scale(this.scalarOp("/", 1, norm2), this.reverse(mv));
  }

  /** **This is only correct for versors!** */
  normalize(mv: Multivector<T>): Multivector<T> {
    if (optimize("unitNormalize") && mv.knownUnit) return mv;

    const se = this.singleEuclidean(mv);
    if (optimize("singleEuclideanNormalize") && se !== null) {
      return new Multivector(this, "normSE", add => {
        add(se, this.scalarOp("sign", mv.value(se)));
      }).markAsUnit();
    }

    const normSq = this.normSquared(mv) ||
      fail(`trying to normalize null vector ${mv}`);
    return this.scale(
      this.scalarOp("inversesqrt",
        // Use the absolute value for compatibility with the
        // [DFM07] reference implementation.  Does it actually make sense?
        true ? this.scalarOp("abs", normSq) : normSq
      ),
      mv
    ).markAsUnit();
  }

  extract(
    test: (bm: number, value: Scalar<T>) => boolean,
    mv: Multivector<T>,
  ): Multivector<T> {
    return new Multivector(this, "extract", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (test(bitmap, value)) {
          add(bitmap, value);
        }
      }
    });
  }

  extractGrade(grade: number, mv: Multivector<T>): Multivector<T> {
    return this.extract(bm => bitCount(bm) === grade, mv);
  }

  plus(...mvs: Multivector<T>[]): Multivector<T> {
    if (optimize("plusSingle") && mvs.length === 1) {
      return this.checkMine(mvs[0]);
    }
    return new Multivector(this, "plus", add => {
      for (const mv of mvs) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, value);
        }
      }
    });
  }

  /** The core functionality for all kinds of products */
  product2(include: ProdInclusionTest, a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    this.checkMine(a);
    this.checkMine(b);
    let skipped = false;
    return new Multivector(this, include.name + "Prod", add => {
      for (const [bmA, valA] of a) {
        for (const [bmB, valB] of b) {
          if (include(bmA, bmB)) {
            const mf = this.metricFactors(bmA & bmB);
            const flip = productFlips(bmA, bmB) & 1;
            add(bmA ^ bmB, this.flipIf(flip, this.times(mf, valA, valB)));
          } else {
            skipped = true;
          }
        }
      }
    }).markAsUnit(!skipped && a.knownUnit && b.knownUnit);
    // We do not  restrict "unitness propagation" to geometric products.
    // It suffices if the product happens to behave like a geometric product
    // for the given input vectors (i.e., no skipped component pairs).
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  product(include: ProdInclusionTest, mvs: Multivector<T>[]): Multivector<T> {
    return mvs.length === 0
      ? new Multivector(this, include + "1", add => add(0, 1)).markAsUnit()
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
    return this.makeScalar("scalarProd", add => {
      for (const [bitmap, valA] of a) {
        const valB = b.value(bitmap);
        const mf = this.metricFactors(bitmap);
        // Notice that reverseFlips(bitmap) === productFlips(bitmap, bitmap) & 1:
        add(this.flipIf(reverseFlips(bitmap), this.times(mf, valA, valB)));
      }
    });
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
      return new Multivector(this, "expNull", add => {
        add(0, 1);
        for (const [bitmap, value] of A) {
          add(bitmap, value);
        }
      })
      // TODO can we mark this as unit unconditionally?
      .markAsUnit([...A].every(([_, value]) => value === 0));
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const alpha = this.scalarOp("sqrt", norm2);
      const cos = this.scalarOp("cos", alpha);
      const sin = this.scalarOp("sin", alpha);
      const sinByAlpha = this.scalarOp("/", sin, alpha);
      return new Multivector(this, "exp", add => {
        add(0, cos);
        for (const [bitmap, value] of A) {
          add(bitmap, this.times(sinByAlpha, value));
        }
      }).markAsUnit(); // this is even correct with a non-Euclidean metric
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
    const atan = this.scalarOp("atan2", R2Norm, R0);
    const scalarFactor = this.scalarOp("/", atan, R2Norm);
    return this.scale(scalarFactor, R2);
  }

  // ----------------------------------------------------
  // Utilities (TODO Separate them from the core methods?)

  dist(a: Multivector<T>, b: Multivector<T>): Scalar<T> {
    return this.norm(this.plus(a, this.negate(b)));
  }
  
  /** **EXPECTS 1-VECTORS** */
  getAngle(a: Multivector<T>, b: Multivector<T>): Scalar<T> {
    return this.scalarOp("atan2",
      this.norm(this.wedgeProduct(a, b)),
      this.scalarProduct(a, b),
    );
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
    const scale = this.scalarOp("/", 1, this.scalarOp("sin", Omega));
    return (t: Scalar<T>) => {
      const scaleA = this.times(scale,
        this.scalarOp("sin", this.times(this.scalarOp("-", 1, t), Omega))
      );
      const scaleB = this.times(scale,
        this.scalarOp("sin", this.times(t                       , Omega))
      );
      return (
        this.plus(this.scale(scaleA, a), this.scale(scaleB, b))
        .markAsUnit(a.knownUnit && b.knownUnit)
        // Unitness is not detected by the lower-level operations.
      );
    }
  }

  // TODO similar optimizations for other scalar operators/functions
  times(...factors: Scalar<T>[]): Scalar<T> {
    if (!optimize("times")) {
      return factors.reduce((acc, f) => this.scalarOp("*", acc, f), 1);
    }
    let num = 1;
    const sym: T[] = [];
    for (const factor of factors) {
      if (typeof factor === "number") {
        // This is not absolutely correct.  If one operator is 0 and another one
        // is NaN or infinity, the unoptimized computation would not return 0.
        // (But we are in "fast-math mode". ;-)
        if (factor === 0) return 0;
        num *= factor;
      } else {
        sym.push(factor);
      }
    }
    const simplified: Scalar<T>[] =
      // TODO If num === -1, use unary minus?
      num !== 1 || sym.length === 0 ? [...sym, num] : sym;
    return simplified.reduce((acc, f) => this.scalarOp("*", acc, f));
  }

  flipIf(condition: truth, value: Scalar<T>): Scalar<T> {
    return condition ? this.scalarOp("unaryMinus", value) : value;
  }

  scalarOp(name: string, ...args: Scalar<T>[]): Scalar<T> {
    return (
      optimize("scalarOp") && args.every(arg => typeof arg === "number")
      ? scalarOp(name, ...args)
      : this.be.scalarOp(name, ...args)
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
          lazy(() => this.times(lVal, lrMetric, rVal));

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
            term: lazy(() => this.times(lrVal(), lr_iMetric)),
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
        const entry = this.makeScalar(`matrix_${from}_${to}`, add => {
          for (const {count, term} of Object.values(cache2.children)) {
            if (!optimize("sandwichCancel1") || count != 0) {
              // TODO Construct an example where the laziness of term avoids
              // generating some superfluous code.  (Or remove the laziness.)
              add(this.times(count, term()));
            }
          }
        });
        if (!optimize("sandwichCancel2") || entry !== 0) {
          cache2.entry = entry;
        }
      });
    });

    return (operand) => {
      this.checkMine(operand);
      return new Multivector<T>(this, "sandwich", add => {
        // The remaining code is essentially a matrix/vector multiplication:
        for (const [iBitmap, iVal] of operand) {
          const cache1 = cache[iBitmap] ?? fail(
            `sandwich-operand component "${this.bitmapToString[iBitmap]
            }" missing in component list`
          );
          cache1.forEach((cache2, lirBitmap) => {
            add(lirBitmap, this.times(cache2.entry, iVal));
          });
        }
      }).markAsUnit(operator.knownUnit && operand.knownUnit);
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
