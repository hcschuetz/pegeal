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
  times(a: Factor<T>, b: Factor<T>): Factor<T> {
    // This is not absolutely correct.  If one operator is 0 and the other
    // one is NaN or infinity, the unoptimized computation would not return 0.
    return a === 0 || b === 0 ? 0 : this.ctx.binop("*", a, b);
  }

  /**
   * Specialization of
   * `geometricProduct(operator, operand, reverse(operator))`
   * 
   * **THE OPERATOR IS EXPECTED TO BE A UNIT VERSOR**
   */
  sandwich(operator: MultiVector<T>, operand: MultiVector<T>): MultiVector<T> {
    this.checkMine(operand);
    this.checkMine(operator);
    let gradeMap = [...operand].reduce((acc, [bm]) => acc | (1 << bitCount(bm)), 0);
    return new MultiVector(this, "sandwich", add => {
      for (const [bmA, valA] of operator) {
        for (const [bmB, valB] of operand) {
          const mfAB = this.metricFactors(bmA & bmB);
          if (mfAB !== null) {
            const bmAB = bmA ^ bmB;
            const flipsAB = productFlips(bmA, bmB);
            for (const [bmC, valC] of operator) {
              const mfAB_C = this.metricFactors(bmAB & bmC);
              if (mfAB_C !== null) {
                const bmOut = bmAB ^ bmC;
                // Sandwiching preserves the grade(s) of the operand.
                // So we can omit output terms with grades not occurring
                // in the operand.
                // TODO Implement a more general, less ad-hoc solution?
                // (There might be result components for which some but not
                // all terms cancel out.)
                if ((1 << bitCount(bmOut)) & gradeMap) {
                  const flips =
                    flipsAB + productFlips(bmAB, bmC) + ((bitCount(bmC) & 2) >> 1);
                  add(bmOut, [...mfAB, ...mfAB_C, valA, valB, valC], flips & 1);
                }
              }
            }
          }
        }
      }
    }).markAsUnit(operator.knownUnit && operand.knownUnit);
  }

  sandwich1(operator: MultiVector<T>, operand: MultiVector<T>): MultiVector<T> {
    // same grade-dropping hack as in .sandwich(...), but re-using product methods
    // (and, at least for now, a more simplistic test implementation.)
    const gradeTest: ProdInclude = (bmA, bmB) =>
      [...operand].some(([bm]) => bitCount(bm) === bitCount(bmA & bmB));
    return this.product2(gradeTest,
      this.geometricProduct(operator, operand),
      this.reverse(operator)
    )
  }

  sandwich2(operator: MultiVector<T>, operand: MultiVector<T>): MultiVector<T> {
    this.checkMine(operand);
    this.checkMine(operator);
    let gradeMap = [...operand].reduce((acc, [bm]) => acc | (1 << bitCount(bm)), 0);
    return new MultiVector(this, "sandwich", add => {
      for (const [bmA, valA] of operator) {
        for (const [bmB, valB] of operand) {
          for (const [bmC, valC] of operator) {
            const bmAB = bmA ^ bmB;
            const bmOut = bmAB ^ bmC;
            const flips =
              productFlips(bmA, bmB) + productFlips(bmAB, bmC) + (bitCount(bmC) >> 1);
  	        const mfAB = this.metricFactors(bmA & bmB);
            const mfAB_C = this.metricFactors(bmAB & bmC);
            if (
              mfAB !== null &&
              mfAB_C !== null &&
              ((1 << bitCount(bmOut)) & gradeMap)
            ) {
              add(bmOut, [...mfAB, ...mfAB_C, valA, valB, valC], flips & 1);
            }
          }
        }
      }
    }).markAsUnit(operator.knownUnit && operand.knownUnit);
  }

  sandwichX(operators: MultiVector<T>[], operand: MultiVector<T>): MultiVector<T> {
    for (const vector of operators) this.checkMine(vector);
    this.checkMine(operand);

    const tree = new ProdTree<T>();    

    const recur = (
      operatorIdx: number,
      bms: number[],
      values: Term<T>,
      revFlips: number,
    ): void => {
      if (operatorIdx >= 0) {
        const v = operators[operatorIdx];
        for (const [bmLeft, valueLeft] of v) {
          for (const [bmRight, valueRight] of v) {
            recur(
              operatorIdx - 1,
              [bmLeft, ...bms, bmRight],
              [valueLeft, ...values, valueRight],
              revFlips + ((bitCount(bmRight) & 2) >> 1),
            );
          }
        }
      } else {
        // TODO compute flipsTotal/mvTotal/bmTotal during the recursion ?
        let flipsTotal = revFlips;
        let mfTotal: Term<T> = [];
        let bmTotal = 0;
        for (const bm of bms) {
          flipsTotal += productFlips(bmTotal, bm);
          const mf = this.metricFactors(bmTotal & bm);
          if (mf === null) return;
          mfTotal.push(...mf);
          bmTotal ^= bm;
        }
        tree.add(bmTotal, [...values, ...mfTotal], flipsTotal);
      }
    }

    for (const [bm, value] of operand) {
      recur(operators.length - 1, [bm], [value], 0);
    }

    tree.optimize();

    return new MultiVector(this, "sandwichX", add => {
      tree.traverse<Factor<T> | undefined>(undefined,
        (state, name) => state === undefined ? name : this.times(state, name),
        (state, bitmap, leaf) => {
          add(bitmap, [state ?? 1, leaf.numProd], leaf.negate);
        },
      );
    })
  }
}

type ProdTreeLeaf<T> = {
  numProd: number,
  negate: boolean,
};

type ProdTreeNode<T> = {
  // Attention:
  // - leavess is a sparse array whose indices are bitmaps of output
  //   base-blades
  // - each element of leavess is a plain list whose indices are irrelevant
  leavess: ProdTreeLeaf<T>[][],
  children: Map<T, ProdTreeNode<T>>;
};

class ProdTree<T> {
  root: ProdTreeNode<T> = {
    leavess: [],
    children: new Map<T, ProdTreeNode<T>>(),
  };

  add(bitmap: number, term: Term<T>, flips: number) {
    const [numbers, names] = extractNumbers(term);
    // Multiplication on the computer is not associative, which makes it hard
    // to detect cancelling candidates. Sorting the numbers avoids this problem.
    const numProd = numbers.sort().reduce((x, y) => x * y, 1);
    // Sorting the names in order to move branching to deeper tree levels
    // and thus to improve sharing common calculation results.
    // For now we do not care about the actual sort order and we just use the
    // JS default.  TODO A little more optimization might be achieved by
    // putting frequently-occurring names early in the list.
    names.sort();

    // TODO make this iterative?
    // (or leave it recursive just for analogy with the other ProdTree methods?)
    function recur(node: ProdTreeNode<T>, nameIdx: number): void {
      if (nameIdx === names.length) {
        const {leavess} = node;
        let leaves = leavess[bitmap];
        if (leaves === undefined) {
          leaves = [];
          leavess[bitmap] = leaves;
        }
        leaves.push({numProd, negate: Boolean(flips & 1)});
      } else {
        const {children} = node;
        const name = names[nameIdx];
        let child = children.get(name);
        if (child === undefined) {
          child = {leavess: [], children: new Map<T, ProdTreeNode<T>>()};
          children.set(name, child);
        }
        recur(child, nameIdx + 1);
      }
    };

    recur(this.root, 0);
  }

  optimize() {
    function recur(node: ProdTreeNode<T>) {
      node.leavess.forEach((leaves, i) => {
        let sum = leaves.reduce(
          (acc, {numProd, negate}) => acc + numProd * (negate ? -1 : 1),
          0
        );
        leaves.length = 0;
        if (sum !== 0) { // TODO or sufficiently close to 0
          leaves.push({numProd: sum, negate: false});
        }
      });
      for (const [key, value] of node.children.entries()) {
        recur(value);
      }
    }

    recur(this.root);
  }

  traverse<U>(
    initialState: U,
    handleChild: (state: U, name: T) => U,
    handleLeaf: (state: U, bitmap: number, leaf: ProdTreeLeaf<T>) => void,
  ) {
    function recur(node: ProdTreeNode<T>, state: U) {
      node.leavess.forEach((leaves, bitmap) => {
        for (const leaf of leaves) {
          handleLeaf(state, bitmap, leaf);
        }
      });
      for (const [key, child] of node.children.entries()) {
        recur(child, handleChild(state, key));
      }
    }

    recur(this.root, initialState);
  }

  toString() {
    const lines: string[] = [];
    function recur(indent: string, node: ProdTreeNode<T>) {
      lines.push(indent + JSON.stringify(node.leavess));
      for (const [name, child] of node.children.entries()) {
        lines.push(indent + name + ":");
        recur(indent + ". ", child);
      }
    }
    recur("", this.root);
    return lines.join("\n");
  }
}

function extractNumbers<T>(list: Term<T>): [number[], T[]] {
  const numbers: number[] = [], rest: T[] = [];
  for (const x of list) {
    if (typeof x === "number") {
      numbers.push(x);
    } else {
      rest.push(x);
    }
  }
  return [numbers, rest];
}
