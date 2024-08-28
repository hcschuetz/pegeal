export type Factor<T> = number | T;
export type Term<T> = Factor<T>[];

export interface Var<T> {
  add(term: Term<T>, negate?: any): void;
  value(): Factor<T>;
}

// Extend these as needed
export type ScalarFuncName = "abs" | "sign" | "sqrt" | "cos" | "sin" | "cosh" | "sinh";
export type ScalarFunc2Name = "+" | "-" | "*" | "/" | "atan2" | "max" | "min";

export interface Context<T> {
  space(): void;
  makeVar(nameHint: string): Var<T>;
  scalarFunc(name: ScalarFuncName, f: Factor<T>): Factor<T>;
  scalarFunc2(name: ScalarFunc2Name, f1: Factor<T>, f2: Factor<T>): Factor<T>;
}

export class MultiVector<T> {
  #components: Var<T>[] = [];

  /** Do we know (at code-generation time) that this multivector has norm 1? */
  knownUnit = false;

  constructor(
    readonly alg: Algebra<T>,
    readonly name: string,
    initialize: (component: (bm: number, term: Term<T>, negate?: any) => unknown) => unknown,
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

  getComponents(): {bitmap: number, value: Factor<T>}[] {
    return this.#components.map((variable: Var<T>, bitmap: number) =>
        ({bitmap, value: variable.value()})
      ).filter(entry => entry !== undefined);
  }

  markAsUnit(mark: boolean): MultiVector<T> {
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

type ProductKind = "wedge" | "geom" | "contrL" | "contrR" | "dot" | "scalar";

/**
 * For each product kind a test whether the product of two basis blades
 * (represented as bitmaps) should be included in the product.
 */
const includeProduct = (kind: ProductKind, bmA: number, bmB: number): boolean  => {
  switch (kind) {                                   // condition on the set of
                                                    // involved basis vectors:
    case "wedge" : return !(bmA & bmB);                   // A ⋂ B = {}
    case "geom"  : return true;                           // true
    case "contrL": return !(bmA & ~bmB);                  // A ⊂ B
    case "contrR": return !(~bmA & bmB);                  // A ⊃ B
    case "dot"   : return !(bmA & ~bmB) || !(~bmA & bmB); // A ⊂ B or A ⊃ B
    case "scalar": return !(bmA ^ bmB);                   // A = B
  }
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

    if (bitmapToString.length !== 1 << nDimensions) {
      throw new Error("sizes of metric and component names do not fit");
    }
    const {stringToBitmap} = this;
    bitmapToString.forEach((name, bm) => {
      stringToBitmap[name] = bm;
    });

    this.fullBitmap = (1 << nDimensions) - 1;
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

  checkMine(mv: MultiVector<T>): void {
    if (mv.alg !== this) throw new Error("trying to use foreign multivector");
  }

  mv(nameHint: string, obj: Record<string, Factor<T>>) {
    return new MultiVector(this, nameHint, add => {
      Object.entries(obj).forEach(([key, val]) => {
        const bm = this.stringToBitmap[key];
        if (bm === undefined) {
          throw new Error(`unexpected key in mv data: ${key}`);
        }
        add(bm, [val]);
      });
    });
  }

  zero(): MultiVector<T> {
    return new MultiVector(this, "zero", () => {});
  };
  one(): MultiVector<T> {
    return new MultiVector(this, "one", add => add(0, [])).markAsUnit(true);
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

    // no `this.checkMine(mv);` here as `mv` may actually come from elsewhere
    const {nDimensions} = this;
    return new MultiVector(this, "morph", add => {
      for (const {bitmap: bitmapIn, value: f} of mv.getComponents()) {
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
    this.checkMine(mv);
    return new MultiVector(this, "scale", add => {
      if (alpha !== 0) {
        for (const {bitmap, value} of mv.getComponents()) {
          add(bitmap, [alpha, value]);
        }
      }
    });
  }

  negate(mv: MultiVector<T>): MultiVector<T> {
    this.checkMine(mv);
    return new MultiVector(this, "negate", add => {
      for (const {bitmap, value} of mv.getComponents()) {
        add(bitmap, [value], true);
      }
    }).markAsUnit(mv.knownUnit);
  }

  gradeInvolution(mv: MultiVector<T>): MultiVector<T> {
    this.checkMine(mv);
    return new MultiVector(this, "gradeInvolution", add => {
      for (const {bitmap, value} of mv.getComponents()) {
        add(bitmap, [value], bitCount(bitmap) & 1);
      }
    }).markAsUnit(mv.knownUnit);
  }

  reverse(mv: MultiVector<T>): MultiVector<T> {
    this.checkMine(mv);
    return new MultiVector(this, "reverse", add => {
      for (const {bitmap, value} of mv.getComponents()) {
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
    for (const {bitmap, value} of mv.getComponents()) {
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
    this.checkMine(mv);
    let foundBlade: number | null = null;
    for (const {bitmap, value} of mv.getComponents()) {
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
      this.ctx.scalarFunc2("max", 0, this.normSquared(mv))
    );
  }

  /** **This is only correct for versors!** */
  inverse(mv: MultiVector<T>): MultiVector<T> {
    if (mv.knownUnit) return mv;
    const norm2 = this.normSquared(mv);
    if (norm2 === 0) {
      throw new Error(`trying to invert null vector ${mv}`);
    }
    return this.scale(this.ctx.scalarFunc2("/", 1, norm2), mv);
  }

  /** **This is only correct for versors!** */
  normalize(mv: MultiVector<T>): MultiVector<T> {
    const {ctx} = this;

    if (mv.knownUnit) return mv;

    const se = this.singleEuclidean(mv);
    if (se !== null) {
      return new MultiVector(this, "normSE", add => add(se, [
        ctx.scalarFunc("sign", mv.value(se))
      ])).markAsUnit(true);
    }

    const normSq = this.normSquared(mv);
    if (normSq === 0) {
      throw new Error(`trying to normalize null vector ${mv}`);
    }
    return this.scale(
      ctx.scalarFunc2("/", 1,
        ctx.scalarFunc("sqrt",
          // Use the absolute value for compatibility with the
          // [DFM07] reference implementation.  Does it actually make sense?
          true ? ctx.scalarFunc("abs", normSq) : normSq
        )
      ),
      mv
    ).markAsUnit(true);
  }

  extractGrade(grade: number, mv: MultiVector<T>): MultiVector<T> {
    this.checkMine(mv);
    return new MultiVector(this, "extract" + grade, add => {
      for (const {bitmap, value} of mv.getComponents()) {
        if (bitCount(bitmap) === grade) {
          add(bitmap, [value]);
        }
      }
    });
  }

  plus(...mvs: MultiVector<T>[]): MultiVector<T> {
    if (mvs.length === 1) {
      this.checkMine(mvs[0]);
      return mvs[0];
    }
    return new MultiVector(this, "plus", add => {
      for (const mv of mvs) {
        this.checkMine(mv);
        for (const {bitmap, value} of mv.getComponents()) {
          add(bitmap, [value]);
        }
      }
    });
  }

  /** The core functionality for all kinds of products */
  private product2(kind: ProductKind, a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    this.checkMine(a);
    this.checkMine(b);
    let skipped = false;
    return new MultiVector(this, kind + "Prod", add => {
      for (const {bitmap: bmA, value: valA} of a.getComponents()) {
        for (const {bitmap: bmB, value: valB} of b.getComponents()) {
          if (includeProduct(kind, bmA, bmB)) {
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
  private product(kind: ProductKind, mvs: MultiVector<T>[]): MultiVector<T> {
    return mvs.length === 0
      ? new MultiVector(this, kind + "1", add => add(0, [])).markAsUnit(true)
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
  scalarProduct(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    this.checkMine(a);
    this.checkMine(b);
    this.ctx.space();
    const variable = this.ctx.makeVar("scalarProd");
    for (const {bitmap, value: valA} of a.getComponents()) {
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
   * **EXPECTS A 2-BLADE AND POSITIVE-DEFINITE METRIC**
   */
  exp(A: MultiVector<T>): MultiVector<T> {
    // Notice that [DFM09] p. 185 use A**2, which is -norm2 for a 2-blade.
    const norm2 = this.normSquared(A);
    if (norm2 === 0) {
      return new MultiVector(this, "expNull", add => {
        add(0, [1]);
        for (const {bitmap, value} of A.getComponents()) {
          add(bitmap, [value]);
        }
      }).markAsUnit(A.getComponents().every(({value}) => value === 0));
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const {ctx} = this;
      const alpha = ctx.scalarFunc("sqrt", norm2);
      const cos = ctx.scalarFunc("cos", alpha);
      const sin = ctx.scalarFunc("sin", alpha);
      const sinByAlpha = ctx.scalarFunc2("/", sin, alpha);
      const components = A.getComponents();
      return new MultiVector(this, "exp", add => {
        add(0, [cos]);
        for (const {bitmap, value} of components) {
          add(bitmap, [sinByAlpha, value]);
        }
      })
      .markAsUnit(
        // testing if relevant coordinates are Euclidian
        components.every(({bitmap}) =>
          bitList(bitmap).every(i =>
            this.metric[i] === 1
          )
        )
      );
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
    const atan = ctx.scalarFunc2("atan2", R2Norm, R0);
    const scalarFactor = ctx.scalarFunc2("/", atan, R2Norm);
    return this.scale(scalarFactor, R2);
  }

  // ----------------------------------------------------
  // Utilities (TODO Separate them from the core methods?)

  dist(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    return this.norm(this.plus(a, this.negate(b)));
  }
  
  /** **EXPECTS 1-VECTORS.  DOES IT ASSUME A EUCLIDEAN METRIC?** */
  getAngle(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    const prod = this.geometricProduct(this.normalize(a), this.normalize(b));
    return this.ctx.scalarFunc2("atan2",
      this.norm(this.extractGrade(2, prod)),
      prod.value(0)
    );
  }

  /** **DOES THIS ASSUME A EUCLIDEAN METRIC?** */
  slerp(a: MultiVector<T>, b: MultiVector<T>) {
    const {ctx} = this;
    a = this.normalize(a);
    b = this.normalize(b);
    const Omega = this.getAngle(a, b);
    const scale = ctx.scalarFunc2("/", 1, ctx.scalarFunc("sin", Omega));
    return (t: Factor<T>) => (
      this.scale(
        scale,
        this.plus(
          this.scale(
            ctx.scalarFunc("sin",
              ctx.scalarFunc2("*", ctx.scalarFunc2("-", 1, t), Omega)
            ),
            a
          ),
          this.scale(
            ctx.scalarFunc("sin",
              ctx.scalarFunc2("*", t, Omega)
            ),
            b
          )
        )
      )
      // Unitness is not detected by the lower-level operations.
      .markAsUnit(true)
    );
  }
}
