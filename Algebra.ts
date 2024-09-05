export type Factor<T> = number | T;
export type Term<T> = Factor<T>[];

export interface Var<T> {
  add(term: Term<T>, negate?: any): void;
  value(): Factor<T>;
}

export abstract class AbstractVar<T> implements Var<T> {
  #frozen = false;

  abstract addImpl(term: Term<T>, negate?: any): void;
  onFreeze() {}
  abstract valueImpl(): Factor<T>;

  add(term: Term<T>, negate?: any): void {
    if (this.#frozen) throw new Error("trying to update frozen variable");
    this.addImpl(term, negate);
  }

  value(): Factor<T> {
    if (!this.#frozen) {
      this.onFreeze();
      this.#frozen = true;
    }
    return this.valueImpl();
  }
}

// Extend these as needed
export type BinOp = "+" | "-" | "*" | "/";

export interface Context<T> {
  makeVar(nameHint: string): Var<T>;
  scalarFunc(name: string, ...args: Factor<T>[]): Factor<T>;
  binop(name: BinOp, f1: Factor<T>, f2: Factor<T>): Factor<T>;
  space(): void;
}

export class MultiVector<T> implements Iterable<[number, Factor<T>]> {
  #components: Var<T>[] = [];

  constructor(
    readonly alg: Algebra<T>,
    readonly name: string,
    initialize: (add: (bm: number, term: Term<T>, negate?: any) => unknown) => unknown,
  ) {
    alg.ctx.space();
    initialize((bm, term, negate?) => {
      let variable = this.#components[bm];
      if (variable === undefined) {
        variable = this.#components[bm] =
          this.alg.ctx.makeVar(this.name + "_" + this.alg.bitmapToString[bm]);
      }
      variable.add(term, negate);
    });
  }

  value(bm: number): Factor<T> { return this.#components[bm]?.value() ?? 0; }

  *[Symbol.iterator](): Generator<[number, Factor<T>], void, unknown> {
    for (const [bitmap, variable] of this.#components.entries()) {
      if (variable !== undefined) {
        yield [bitmap, variable.value()];
      }
    }
  }

  /** Do we know (at code-generation time) that this multivector has norm 1? */
  #knownUnit = false;
  public get knownUnit() {
    return this.#knownUnit;
  }
  public set knownUnit(mark) {
    // // Debug code looking for non-unit multivectors being marked as unit:
    // if (mark && this.alg.ctx instanceof EvalContext) {
    //   const THIS = this as any as MultiVector<never>;
    //   let n2 = 0;
    //   for (const [bm, variable] of THIS.#components.entries()) {
    //     if (variable === undefined) continue;
    //     const mf = THIS.alg.metricFactors(bm);
    //     if (mf === null) continue;
    //     const val = variable.value();
    //     n2 += [...mf, val, val].reduce((x, y) => x*y);
    //   }
    //   console.log("# UNIT: " + n2);
    //   // n2 ~ -1 is also allowed:
    //   if (Math.abs(Math.abs(n2) - 1) > 1e-10) {
    //     throw new Error("Marking a non-unit multivector as unit");
    //   }
    // }

    this.#knownUnit = mark;
  }

  /** Fluent wrapper around `this.knownUnit = ...` */
  markAsUnit(mark: boolean = true): MultiVector<T> {
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
  // Kernighan method:
  while (bitmap) {
    bitmap &= bitmap - 1;
    result++;
  }
  // // Naive version:
  // forBitmap(bitmap, () => result++);
  return result;
}

/**
 * Test whether the product of two base blades should be included in a
 * multivector product.
 * 
 * Instances of this function type should have a name that is suitable as an
 * identifier.
 */
type ProdInclude = (bmA: number, bmB: number) => boolean;

// For each product kind a test whether the product of two basis blades
// (represented as bitmaps) should be included in the product.
const incl: Record<string, ProdInclude> = {
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

// The bitmap operations above correspond to the following conditions on
// basis-vector sets and grades:
// ------------------+-----------------+----------------------------------------
// product kind      | condition on    | grade-based test using
//                   | the sets of     | gA   := bitcount(bmA)
//                   | input basis     | gB   := bitcount(bmB)
//                   | vectors         | gOut := bitcount(bmA ^ bmB)
// ------------------+-----------------+----------------------------------------
// geometric         | true            | true
// wedge             | A ⋂ B = {}      | gOut === gA + gB
// left contraction  | A ⊂ B           | gOut === gB - gA
// right contraction | A ⊃ B           | gOut === gA - gB
// scalar            | A = B           | gOut === 0
// dot               | A ⊂ B or A ⊃ B  | gOut === |gA - gB|
// ------------------+-----------------+----------------------------------------
// To emphasize their analogy, the "scalar" and "dot" cases could be defined as:
// scalar            | A ⊂ B and A ⊃ B | gOut === gB - gA && gOut === gA - gB
// dot               | A ⊂ B or  A ⊃ B | gOut === gB - gA || gOut === gA - gB
// ------------------+-----------------+----------------------------------------
// Notice that the set-based conditions (and thus also the bitmap conditions)
// can be formulated using just the inputs whereas the grade-based conditions
// also need the result property gOut.

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

export class Algebra<T> {
  readonly nDimensions: number;
  readonly fullBitmap: number;
  readonly stringToBitmap: Record<string, number> = {};

  constructor(
    readonly metric: Factor<T>[],
    readonly ctx: Context<T>,
    readonly bitmapToString: string[],
  ) {
    const nDimensions = this.nDimensions = metric.length;
    this.fullBitmap = (1 << nDimensions) - 1;

    if (bitmapToString.length !== 1 << nDimensions) {
      throw new Error("sizes of metric and component names do not fit");
    }
    bitmapToString.forEach((name, bm) => this.stringToBitmap[name] = bm);
  }

  /** Return a term for the metric or 0 if the term is always 0. */
  metricFactors(bm: number): Term<T> | null {
    const result = [];
    for (const i of bitList(bm)) {
      const f = this.metric[i];
      switch (f) {
        case 0: return null;
        case 1: break;
        default: result.push(f);
      }
    }
    return result;
  }

  checkMine(mv: MultiVector<T>): MultiVector<T> {
    if (mv.alg !== this) throw new Error("trying to use foreign multivector");
    return mv;
  }

  mv(nameHint: string, obj: Record<string, Factor<T>>) {
    return new MultiVector(this, nameHint, add => {
      for (const [key, val] of Object.entries(obj)) {
        const bm = this.stringToBitmap[key];
        if (bm === undefined) {
          throw new Error(`unexpected key in mv data: ${key}`);
        }
        add(bm, [val]);
      }
    });
  }

  zero(): MultiVector<T> {
    return new MultiVector(this, "zero", () => {});
  };
  one(): MultiVector<T> {
    return new MultiVector(this, "one", add => add(0, [])).markAsUnit();
  }
  pseudoScalar(): MultiVector<T> {
    return new MultiVector(this, "ps", add => add(this.fullBitmap, []))
      .markAsUnit(this.metric.every(v => v === 1));
  }
  pseudoScalarInv(): MultiVector<T> {
    return this.inverse(this.pseudoScalar());
  }
  basisVectors(): MultiVector<T>[] {
    return this.metric.map((_, i) =>
      new MultiVector(this, "basis" + i, add => add(1 << i, []))
      .markAsUnit(this.metric[i] === 1)
    )
  }

  outermorphism(mv: MultiVector<T>, matrix: (Factor<T> | undefined)[][]): MultiVector<T> {
    // See `doc/Outermorphism.md` for explanations.

    const {nDimensions} = this;
    return new MultiVector(this, "morph", add => {
      // no `this.checkMine(mv)` here as `mv` may actually come from elsewhere
      for (const [bitmapIn, f] of mv) {
        function recur(i: number, bitmapOut: number, flips: number, product: Factor<T>[]) {
          const iBit = 1 << i;
          if (iBit > bitmapIn) {
            // Fully traversed bitmapIn.  Contribute to the output:
            add(bitmapOut, [...product, f], flips & 1);
          } else if (!(iBit & bitmapIn)) {
            // The i-th basis vector is not in bitmapIn.  Skip it:
            recur(i + 1, bitmapOut, flips, product);
          } else {
            // The i-th basis vector is in bitmapIn.
            // Iterate over the output basis vectors and recur for the
            // "appropriate ones":
            for (let j = 0; j < nDimensions; j++) {
              const jBit = 1 << j;
              if (jBit & bitmapOut) continue; // wedge prod with duplicate is 0
              const elem = (matrix[j] ?? [])[i] ?? 0;
              if (elem === 0) continue; // omit product with a factor 0
              const newFlips = bitCount(bitmapOut & ~(jBit - 1));
              recur(i + 1, bitmapOut | jBit, flips + newFlips, [...product, elem]);
            }
          }
        }

        recur(0, 0, 0, []);
      }
    });
  }

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Factor<T>, mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "scale", add => {
      if (alpha !== 0) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, [alpha, value]);
        }
      }
    });
  }

  negate(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "negate", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], true);
      }
    }).markAsUnit(mv.knownUnit);
  }

  gradeInvolution(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "gradeInvolution", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], bitCount(bitmap) & 1);
      }
    }).markAsUnit(mv.knownUnit);
  }

  reverse(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "reverse", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], bitCount(bitmap) & 2);
      }
    }).markAsUnit(mv.knownUnit);
  }

  dual(mv: MultiVector<T>): MultiVector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
    // TODO Implement directly.
  }

  /**
   * Short for `this.scalarProduct(mv, this.reverse(mv))`.
   */
  // The signs introduced by `reverse` and `scalarProduct` cancel each
  // other out.  Thus there are no sign flips here.
  // (It looks like the `reverse` operation is in the definition of
  // normSquared precisely for this purpose.)
  normSquared(mv: MultiVector<T>): Factor<T> {
    this.checkMine(mv);
    if (mv.knownUnit) return 1; // TODO or -1?

    // TODO If the entire multivector and the relevant metric factors
    // are given as numbers, precalculate the result.

    this.ctx.space();
    const variable = this.ctx.makeVar("normSquared");
    for (const [bitmap, value] of mv) {
      const mf = this.metricFactors(bitmap);
      if (mf !== null) {
        variable.add([...mf, value, value]);
      }
    }
    return variable.value();
  }

  /**
   * "Single euclidean" means that
   * - the multivector has precisely one base blade that might be non-zero
   * - and the metric factors for this base blade are all one.
   *   (Notice that it is not required that the entire metric is euclidean.)
   * 
   * The method returns the bitmap for that single base blade or `null`
   * if the conditions above are not met.
   * 
   * Use this for to simplify/optimize 
   */
  protected singleEuclidean(mv: MultiVector<T>): number | null {
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

  norm(mv: MultiVector<T>): Factor<T> {
    this.checkMine(mv);
    if (mv.knownUnit) return 1;

    const se = this.singleEuclidean(mv);
    if (se !== null) return this.ctx.scalarFunc("abs", mv.value(se));

    return this.ctx.scalarFunc("sqrt",
      // As in the [DFM07] reference implementation we floor the squared norm
      // to 0 to avoid problems when the squared norm is slightly below 0 due
      // to rounding errors.
      // Unfortunately this leaves actual errors undetected if the squared norm
      // is significantly below 0.
      // TODO Check for "truly" negative squared norm?
      // But how to do this in gernerated code?
      // Or just take the absolute value of `normSquared` (as in `normalize`)?
      this.ctx.scalarFunc("max", 0, this.normSquared(mv))
    );
  }

  /** **This is only correct for versors!** */
  inverse(mv: MultiVector<T>): MultiVector<T> {
    if (mv.knownUnit) return mv;
    const norm2 = this.normSquared(mv);
    if (norm2 === 0) {
      throw new Error(`trying to invert null vector ${mv}`);
    }
    return this.scale(this.ctx.binop("/", 1, norm2), mv);
  }

  /** **This is only correct for versors!** */
  normalize(mv: MultiVector<T>): MultiVector<T> {
    const {ctx} = this;

    if (mv.knownUnit) return mv;

    const se = this.singleEuclidean(mv);
    if (se !== null) {
      return new MultiVector(this, "normSE", add => add(se, [
        ctx.scalarFunc("sign", mv.value(se))
      ])).markAsUnit();
    }

    const normSq = this.normSquared(mv);
    if (normSq === 0) {
      throw new Error(`trying to normalize null vector ${mv}`);
    }
    return this.scale(
      ctx.scalarFunc("inversesqrt",
        // Use the absolute value for compatibility with the
        // [DFM07] reference implementation.  Does it actually make sense?
        true ? ctx.scalarFunc("abs", normSq) : normSq
      ),
      mv
    ).markAsUnit();
  }

  extractGrade(grade: number, mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "extract" + grade, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (bitCount(bitmap) === grade) {
          add(bitmap, [value]);
        }
      }
    });
  }

  extract(
    test: (bm: number, value: Factor<T>) => boolean,
    mv: MultiVector<T>,
  ): MultiVector<T> {
    return new MultiVector(this, "extract", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (test(bitmap, value)) {
          add(bitmap, [value]);
        }
      }
    });
  }

  plus(...mvs: MultiVector<T>[]): MultiVector<T> {
    if (mvs.length === 1) {
      return this.checkMine(mvs[0]);
    }
    return new MultiVector(this, "plus", add => {
      for (const mv of mvs) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, [value]);
        }
      }
    });
  }

  /** The core functionality for all kinds of products */
  product2(include: ProdInclude, a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    this.checkMine(a);
    this.checkMine(b);
    let skipped = false;
    return new MultiVector(this, include.name + "Prod", add => {
      for (const [bmA, valA] of a) {
        for (const [bmB, valB] of b) {
          if (include(bmA, bmB)) {
            const mf = this.metricFactors(bmA & bmB);
            if (mf !== null) {
              add(bmA ^ bmB, [...mf, valA, valB], productFlips(bmA, bmB) & 1);
            }
          } else {
            skipped = true;
          }
        }
      }
    }).markAsUnit(!skipped && a.knownUnit && b.knownUnit);
    // TODO Check if the geometric product of units is really always a unit.

    // We do not  restrict "unitness propagation" to geometric products.
    // It suffices if the product happens to behave like a geometric product
    // for the given input vectors (i.e., no skipped component pairs).
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  product(include: ProdInclude, mvs: MultiVector<T>[]): MultiVector<T> {
    return mvs.length === 0
      ? new MultiVector(this, include + "1", add => add(0, [])).markAsUnit()
      : mvs.reduce((acc, mv) => this.product2(include, acc, mv));
  }

  wedgeProduct(...mvs: MultiVector<T>[]): MultiVector<T> {
    return this.product(incl.wedge, mvs);
  }

  geometricProduct(...mvs: MultiVector<T>[]): MultiVector<T> {
    return this.product(incl.geom, mvs);
  }

  contractLeft(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2(incl.contrL, a, b);
  }

  contractRight(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2(incl.contrR, a, b);
  }

  dotProduct(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2(incl.dot, a, b);
  }

  /**
   * Implementation returning a multivector that is actually a scalar.
   * (At most the scalar component is filled.)
   */
  scalarProductMV(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2(incl.scalar, a, b);
  }

  /** Implementation returning an object of scalar type. */
  scalarProduct(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    this.checkMine(a);
    this.checkMine(b);
    this.ctx.space();
    const variable = this.ctx.makeVar("scalarProd");
    for (const [bitmap, valA] of a) {
      const valB = b.value(bitmap);
      if (valB !== 0) {
        const mf = this.metricFactors(bitmap);
        if (mf !== null) {
          variable.add([...mf, valA, valB], bitCount(bitmap) & 2);
        }
      }
    }
    return variable.value();
  }

  /**
   * **EXPERIMENTAL!**
   * 
   * **EXPECTS A 2-BLADE AND POSITIVE-SEMIDEFINITE METRIC**
   */
  exp(A: MultiVector<T>): MultiVector<T> {
    // Notice that [DFM09] p. 185 use A**2, which is -norm2 for a 2-blade.
    const norm2 = this.normSquared(A);
    if (norm2 === 0) {
      return new MultiVector(this, "expNull", add => {
        add(0, [1]);
        for (const [bitmap, value] of A) {
          add(bitmap, [value]);
        }
      })
      // TODO can we mark this as unit unconditionally?
      .markAsUnit([...A].every(([_, value]) => value === 0));
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const {ctx} = this;
      const alpha = ctx.scalarFunc("sqrt", norm2);
      const cos = ctx.scalarFunc("cos", alpha);
      const sin = ctx.scalarFunc("sin", alpha);
      const sinByAlpha = ctx.binop("/", sin, alpha);
      return new MultiVector(this, "exp", add => {
        add(0, [cos]);
        for (const [bitmap, value] of A) {
          add(bitmap, [sinByAlpha, value]);
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
  // Notice that R can also be seen as a unit quaternion,
  // except that the xz component is the negative j component.
  log(R: MultiVector<T>): MultiVector<T> {
    const {ctx} = this;
    /** The cosine of the half angle, that is, the real part of the quaternion */
    const R0 = R.value(0);
    /** The imaginary part of the quaternion */
    const R2 = this.extractGrade(2, R);
    /** The sine of the half angle */
    const R2Norm = this.norm(R2);
    if (R2Norm == 0) throw new Error("division by zero in log computation");
    // TODO optimize away atan2 call if R0 == 0.
    const atan = ctx.scalarFunc("atan2", R2Norm, R0);
    const scalarFactor = ctx.binop("/", atan, R2Norm);
    return this.scale(scalarFactor, R2);
  }

  // ----------------------------------------------------
  // Utilities (TODO Separate them from the core methods?)

  dist(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    return this.norm(this.plus(a, this.negate(b)));
  }
  
  /** **EXPECTS 1-VECTORS** */
  getAngle(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    return this.ctx.scalarFunc("atan2",
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
  slerp(a: MultiVector<T>, b: MultiVector<T>) {
    const {ctx} = this;
    const Omega = this.getAngle(a, b);
    const scale = ctx.binop("/", 1, ctx.scalarFunc("sin", Omega));
    return (t: Factor<T>) => {
      const scaleA = this.times(scale,
        ctx.scalarFunc("sin", this.times(ctx.binop("-", 1, t), Omega))
      );
      const scaleB = this.times(scale,
        ctx.scalarFunc("sin", this.times(t                   , Omega))
      );
      return (
        this.plus(this.scale(scaleA, a), this.scale(scaleB, b)).markAsUnit()
        // Unitness is not detected by the lower-level operations.
      );
    }
  }

  // TODO similar optimizations for other scalar operators/functions
  times(...factors: Factor<T>[]): Factor<T> {
    // This is not absolutely correct.  If one operator is 0 and the other
    // one is NaN or infinity, the unoptimized computation would not return 0.
    factors = factors.filter(f => f !== 1);
    return (
      factors.some(f => f === 0) ? 0 :
      factors.length === 0 ? 1 :
      // TODO multiply numeric factors at generation time?
      factors.reduce((acc, f) => this.ctx.binop("*", acc, f))
    );
  }

  /**
   * Like `this.geometricProduct(operator, operand, this.reverse(operator))`
   * but cancelling terms that can be detected at code-generation time
   * to be negations of each other.
   * 
   * **THE OPERATOR IS EXPECTED TO BE A VERSOR**, typically a unit versor
   * for a mirror/rotation operation without stretching/shrinking.
   * 
   * The function is curried, so that the same operator can be "applied" to
   * multiple operands, sharing some intermediate values that only depend
   * on the operator.
   * 
   * If the dummy flag is set, no output to the result multivector is generated,
   * but the intermediate values needed for the given operand will be computed.
   * (This is useful if you apply the second step of the curried function
   * in a loop, but you want to force the computation of the intermediate
   * values before entering the loop.)
   */
  sandwich(operator: MultiVector<T>): (operand: MultiVector<T>, options?: {dummy?: boolean}) => MultiVector<T> {
    this.checkMine(operator);
    // We use name prefixes l, i, and r for the left, inner, and right part
    // of a sandwich product.
    const lrVals: Record<string, () => Factor<T>> = {};
    for (const [lBitmap, lVal] of operator) {
      for (const [rBitmap, rVal] of operator) {
        if (lBitmap > rBitmap) continue;

        const lrMetric = this.metricFactors(lBitmap & rBitmap);
        if (lrMetric === null) continue;

        const lrKey = `${lBitmap},${rBitmap}`;
        if (!Object.hasOwn(lrVals, lrKey)) {
          lrVals[lrKey] = lazy(() => this.times(lVal, rVal, ...lrMetric))
        }
      }
    }
    return (operand, options = {}) => {
      this.checkMine(operand);
      const {dummy = false} = options;
      return new MultiVector<T>(this, "sandwich", add => {
        const lirVals: Record<string, {bm: number, lrVal: () => Factor<T>, term: Term<T>, count: number}> = {}
        for (const [lBitmap] of operator) {
          for (const [rBitmap] of operator) {  
            const lrMetric = this.metricFactors(lBitmap & rBitmap);
            if (lrMetric === null) continue;

            const lrKey = [lBitmap, rBitmap].sort().join(",");
            const lrVal = lrVals[lrKey];
            for (const [iBitmap, iVal] of operand) {
              const lr_iMetric = this.metricFactors((lBitmap ^ rBitmap) & iBitmap);
              if (lr_iMetric === null) continue;
              const liBitmap = lBitmap ^ iBitmap;
              const lirBitmap = liBitmap ^ rBitmap;

              const flips =
                productFlips(lBitmap, iBitmap)
              + productFlips(liBitmap, rBitmap)
              + ((bitCount(rBitmap) >> 1) & 1);
              const flipFactor = flips & 1 ? -1 : 1;

              const lirKey = lrKey + "," + iBitmap;
              const lirVal =
                lirVals[lirKey] ??
                (lirVals[lirKey] = {bm: lirBitmap, lrVal, term: [iVal, ...lr_iMetric], count: 0});
              lirVal.count += flipFactor;
              if (lirVal.count === 0) delete lirVals[lirKey];
            }
          }
        }
        for (const {bm, lrVal, term, count} of Object.values(lirVals)) {
          const lrValue = lrVal();
          if (!dummy) {
            add(bm, [lrValue, ...term, Math.abs(count)].filter(f => f !== 1), Math.sign(count) < 0);
          }
        }
      }).markAsUnit(operator.knownUnit && operand.knownUnit && !dummy);
    };
  }

  /** Straight-forward implementation, for comparison with `.sandwich(...)` */
  sandwich1(operator: MultiVector<T>, operand: MultiVector<T>): MultiVector<T> {
    return this.geometricProduct(operator, operand, this.reverse(operator));
  }
}

function lazy<T>(exec: () => T): () => T {
  let result: T;
  let done = false;
  return () => {
    if (!done) {
      result = exec();
      done = true;
    }
    return result;
  }
}
