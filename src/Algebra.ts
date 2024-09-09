import scalarOp from "./scalarOp";

/**
 * Semantically a boolean, but for convenience any value.
 * Only its truthiness should be used.
 */
export type truth = unknown;

export type Scalar<T> = number | T;
export type Term<T> = Scalar<T>[];

export abstract class Var<T> {
  #created = false;
  #frozen = false;
  #numericPart = 0;

  add(term: Term<T>, negate?: truth): void {
    if (this.#frozen) throw new Error("trying to update frozen variable");

    if (term.some(f => f === 0)) return;

    term = term.filter(f => f !== 1);

    if (term.every(f => typeof f === "number")) {
      this.#numericPart += term.reduce((x, y) => x * y, negate ? -1 : 1);
      return;
    }

    this.addTerm(term, negate, !this.#created);
    this.#created = true;
  }

  value(): Scalar<T> {
    if (!this.#frozen) {
      if (this.#created && this.#numericPart !== 0) {
        this.addTerm([this.#numericPart], false, false);
      }
      this.#frozen = true;
    }
    return this.#created ? this.getValue() : this.#numericPart;
  }

  protected abstract addTerm(term: Term<T>, negate: truth, create: boolean): void;
  protected abstract getValue(): T;
}

export abstract class BackEnd<T> {
  abstract makeVar(nameHint: string): Var<T>;
  abstract scalarOp(name: string, ...args: Scalar<T>[]): Scalar<T>;
  comment(text: string): void {}
}

export class Multivector<T> implements Iterable<[number, Scalar<T>]> {
  #components: Var<T>[] = [];

  constructor(
    readonly alg: Algebra<T>,
    readonly name: string,
    initialize: (
      add: (bm: number, term: Term<T>, negate?: truth) => unknown,
    ) => unknown,
  ) {
    alg.be.comment("mv " + name);
    initialize((bm, term, negate?) => {
      let variable = this.#components[bm];
      if (variable === undefined) {
        variable = this.#components[bm] =
          this.alg.be.makeVar(this.name + "_" + this.alg.bitmapToString[bm]);
      }
      variable.add(term, negate);
    });
  }

  value(bm: number): Scalar<T> { return this.#components[bm]?.value() ?? 0; }

  *[Symbol.iterator](): Generator<[number, Scalar<T>], void, unknown> {
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
    // if (mark && this.alg.be instanceof EvalBackEnd) {
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

  constructor(
    readonly metric: Scalar<T>[],
    readonly be: BackEnd<T>,
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

  checkMine(mv: Multivector<T>): Multivector<T> {
    if (mv.alg !== this) throw new Error("trying to use foreign multivector");
    return mv;
  }

  mv(nameHint: string, obj: Record<string, Scalar<T>>) {
    return new Multivector(this, nameHint, add => {
      for (const [key, val] of Object.entries(obj)) {
        const bm = this.stringToBitmap[key];
        if (bm === undefined) {
          throw new Error(`unexpected key in mv data: ${key}`);
        }
        add(bm, [val]);
      }
    });
  }

  zero(): Multivector<T> {
    return new Multivector(this, "zero", () => {});
  };
  one(): Multivector<T> {
    return new Multivector(this, "one", add => add(0, [])).markAsUnit();
  }
  pseudoScalar(): Multivector<T> {
    return new Multivector(this, "ps", add => add(this.fullBitmap, []))
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
        add => add(bitmap, []),
      ).markAsUnit(this.metric[i] === 1)
    });
  }

  outermorphism(mv: Multivector<T>, matrix: (Scalar<T> | undefined)[][]): Multivector<T> {
    // See `doc/Outermorphism.md` for explanations.

    const {nDimensions} = this;
    return new Multivector(this, "morph", add => {
      // no `this.checkMine(mv)` here as `mv` may actually come from elsewhere
      for (const [bitmapIn, f] of mv) {
        function recur(i: number, bitmapOut: number, flips: number, product: Term<T>) {
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
  scale(alpha: Scalar<T>, mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "scale", add => {
      if (alpha !== 0) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, [alpha, value]);
        }
      }
    });
  }

  negate(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "negate", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], true);
      }
    }).markAsUnit(mv.knownUnit);
  }

  gradeInvolution(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "gradeInvolution", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], gradeInvolutionFlips(bitmap));
      }
    }).markAsUnit(mv.knownUnit);
  }

  reverse(mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "reverse", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        add(bitmap, [value], reverseFlips(bitmap));
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
    if (mv.knownUnit) return 1; // TODO or -1?

    // TODO If the entire multivector and the relevant metric factors
    // are given as numbers, precalculate the result.

    this.be.comment("normSquared");
    const variable = this.be.makeVar("normSquared");
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
    if (mv.knownUnit) return 1;

    const se = this.singleEuclidean(mv);
    if (se !== null) return this.scalarOp("abs", mv.value(se));

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
    if (mv.knownUnit) return mv;
    // TODO provide nicer check for number of components
    if ([...mv].length === 1) {
      return new Multivector(this, "inverse", add => {
        for (const [bm, val] of mv) {
          const mf = this.metricFactors(bm);
          if (mf === null) {
            throw new Error(`trying to invert null vector ${mv}`);
          }
          add(bm, [this.scalarOp("/", 1, this.times(val, ...mf))], reverseFlips(bm));
        }
      });
    }
    const norm2 = this.normSquared(mv);
    if (norm2 === 0) {
      throw new Error(`trying to invert null vector ${mv}`);
    }
    return this.scale(this.scalarOp("/", 1, norm2), this.reverse(mv));
  }

  /** **This is only correct for versors!** */
  normalize(mv: Multivector<T>): Multivector<T> {
    if (mv.knownUnit) return mv;

    const se = this.singleEuclidean(mv);
    if (se !== null) {
      return new Multivector(this, "normSE", add => add(se, [
        this.scalarOp("sign", mv.value(se))
      ])).markAsUnit();
    }

    const normSq = this.normSquared(mv);
    if (normSq === 0) {
      throw new Error(`trying to normalize null vector ${mv}`);
    }
    return this.scale(
      this.scalarOp("inversesqrt",
        // Use the absolute value for compatibility with the
        // [DFM07] reference implementation.  Does it actually make sense?
        true ? this.scalarOp("abs", normSq) : normSq
      ),
      mv
    ).markAsUnit();
  }

  extractGrade(grade: number, mv: Multivector<T>): Multivector<T> {
    return new Multivector(this, "extract" + grade, add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (bitCount(bitmap) === grade) {
          add(bitmap, [value]);
        }
      }
    });
  }

  extract(
    test: (bm: number, value: Scalar<T>) => boolean,
    mv: Multivector<T>,
  ): Multivector<T> {
    return new Multivector(this, "extract", add => {
      for (const [bitmap, value] of this.checkMine(mv)) {
        if (test(bitmap, value)) {
          add(bitmap, [value]);
        }
      }
    });
  }

  plus(...mvs: Multivector<T>[]): Multivector<T> {
    if (mvs.length === 1) {
      return this.checkMine(mvs[0]);
    }
    return new Multivector(this, "plus", add => {
      for (const mv of mvs) {
        for (const [bitmap, value] of this.checkMine(mv)) {
          add(bitmap, [value]);
        }
      }
    });
  }

  /** The core functionality for all kinds of products */
  product2(include: ProdInclude, a: Multivector<T>, b: Multivector<T>): Multivector<T> {
    this.checkMine(a);
    this.checkMine(b);
    let skipped = false;
    return new Multivector(this, include.name + "Prod", add => {
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
    // We do not  restrict "unitness propagation" to geometric products.
    // It suffices if the product happens to behave like a geometric product
    // for the given input vectors (i.e., no skipped component pairs).
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  product(include: ProdInclude, mvs: Multivector<T>[]): Multivector<T> {
    return mvs.length === 0
      ? new Multivector(this, include + "1", add => add(0, [])).markAsUnit()
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
    this.be.comment("scalar product");
    const variable = this.be.makeVar("scalarProd");
    for (const [bitmap, valA] of a) {
      const valB = b.value(bitmap);
      if (valB === 0) continue;
      const mf = this.metricFactors(bitmap);
      if (mf === null) continue;
      // Notice that reverseFlips(bitmap) === productFlips(bitmap, bitmap) & 1:
      variable.add([...mf, valA, valB], reverseFlips(bitmap));
    }
    return variable.value();
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
        add(0, [1]);
        for (const [bitmap, value] of A) {
          add(bitmap, [value]);
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
  log(R: Multivector<T>): Multivector<T> {
    /** The cosine of the half angle, that is, the real part of the quaternion */
    const R0 = R.value(0);
    /** The imaginary part of the quaternion */
    const R2 = this.extractGrade(2, R);
    /** The sine of the half angle */
    const R2Norm = this.norm(R2);
    if (R2Norm == 0) throw new Error("division by zero in log computation");
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
        this.scalarOp("sin", this.times(t                   , Omega))
      );
      return (
        this.plus(this.scale(scaleA, a), this.scale(scaleB, b)).markAsUnit()
        // Unitness is not detected by the lower-level operations.
      );
    }
  }

  // TODO similar optimizations for other scalar operators/functions
  times(...factors: Scalar<T>[]): Scalar<T> {
    factors = factors.filter(f => f !== 1);
    return (
      // This is not absolutely correct.  If one operator is 0 and the other
      // one is NaN or infinity, the unoptimized computation would not return 0.
      factors.some(f => f === 0) ? 0 :
      factors.length === 0 ? 1 :
      // TODO multiply numeric factors at generation time?
      factors.reduce((acc, f) => this.scalarOp("*", acc, f))
    );
  }

  scalarOp(name: string, ...args: Scalar<T>[]) {
    return (
      args.every(arg => typeof arg === "number")
      ? scalarOp(name, ...args)
      : this.be.scalarOp(name, ...args)
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
  sandwich(operator: Multivector<T>): (operand: Multivector<T>, options?: {dummy?: boolean}) => Multivector<T> {
    this.checkMine(operator);
    // We use name prefixes l, i, and r for the left, inner, and right part
    // of a sandwich product.
    const lrVals: Record<string, () => Scalar<T>> = {};
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
      return new Multivector<T>(this, "sandwich", add => {
        const lirVals: Record<string, {bm: number, lrVal: () => Scalar<T>, term: Term<T>, count: number}> = {}
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
              + reverseFlips(rBitmap);
              const flipFactor = flips & 1 ? -1 : 1;

              const lirKey = lrKey + "," + iBitmap;
              const lirVal =
                lirVals[lirKey] ??
                (lirVals[lirKey] = {bm: lirBitmap, lrVal, term: [iVal, ...lr_iMetric], count: 0});
              lirVal.count += flipFactor;
            }
          }
        }
        for (const {bm, lrVal, term, count} of Object.values(lirVals)) {
          if (count === 0) continue;
          const lrValue = lrVal();
          if (dummy) continue;
          add(bm, [lrValue, ...term, Math.abs(count)], Math.sign(count) < 0);
        }
      }).markAsUnit(operator.knownUnit && operand.knownUnit && !dummy);
    };
  }

  /** Straight-forward implementation, for comparison with `.sandwich(...)` */
  sandwich1(operator: Multivector<T>, operand: Multivector<T>): Multivector<T> {
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
