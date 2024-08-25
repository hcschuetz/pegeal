export type Factor<T> = number | T;
export type Term<T> = Factor<T>[];

export interface Var<T> {
  add(term: Term<T>): void;
  value(): Factor<T>;
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

export type ScalarFuncName = "abs" | "sqrt" | "cos" | "sin" | "cosh" | "sinh";
export type ScalarFunc2Name = "+" | "-" | "*" | "/" | "atan2";

export interface Context<T> {
  space(): void;
  makeVar(nameHint: string): Var<T>;
  scalarFunc(name: ScalarFuncName, f: Factor<T>): Factor<T>;
  scalarFunc2(name: ScalarFunc2Name, f1: Factor<T>, f2: Factor<T>): Factor<T>;
}

export class MultiVector<T> {
  components: Var<T>[] = [];

  constructor(
    readonly alg: Algebra<T>,
    readonly name: string,
    initialize: (component: (i: number) => Var<T>) => unknown,
  ) {
    alg.ctx.space();
    initialize(i => this.component(i));
  }

  component(bm: number): Var<T> {
    return (
      this.components[bm] ??
      (this.components[bm] = this.alg.ctx.makeVar(this.name + "_" + this.alg.bitmapToString[bm]))
    );
  }

  value(bm: number): Factor<T> { return this.component(bm).value(); }

  forComponents(callback: (bitmap: number, value: Factor<T>) => unknown): void {
    this.components.forEach((variable: Var<T>, bm: number) => {
      callback(bm, variable.value());
    });
  }

  toString() {
    return `${this.name} {${
      this.components
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
 * For each product kind a test whether the product of two basis blades
 * (represented as bitmaps) should be include in the product.
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
    if (bit & bitmapA) { flips += bCount; }
    if (bit & bitmapB) { bCount++; }
  }
  return flips;
}

/** Provide factor -1 if argument is truthy. */
const flipSign = (doFlip: any): Term<never> => doFlip ? [-1] : [];

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
      throw "sizes of metric and component names do not fit";
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

  mv(nameHint: string, obj: Record<string, Factor<T>>) {
    return new MultiVector(this, nameHint, c => {
      Object.entries(obj).forEach(([key, val]) => {
        const bm = this.stringToBitmap[key];
        if (bm === undefined) {
          throw `unexpected key in mv data: ${key}`;
        }
        c(bm).add([val]);
      });
    });
  }

  zero(): MultiVector<T> {
    return new MultiVector(this, "zero", () => {});
  };
  one(): MultiVector<T> {
    return new MultiVector(this, "one", c => c(0).add([]));
  }
  pseudoScalar(): MultiVector<T> {
    return new MultiVector(this, "ps", c => c(this.fullBitmap).add([]));
  }
  pseudoScalarInv(): MultiVector<T> {
    // TODO implement directly?
    return this.inverse(this.pseudoScalar());
  }
  basisVectors(): MultiVector<T>[] {
    return this.metric.map((_, i) =>
      new MultiVector(this, "basis" + i, c => c(1 << i).add([]))
    )
  }

  // TODO Move the methods taking a single MultiVector to the MultiVector class?

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Factor<T>, mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "scale", c => {
      if (alpha !== 0) {
        mv.forComponents((bm, val) => c(bm).add([alpha, val]));
      }
    });
  }

  negate(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "negate", c => {
      mv.forComponents((bm, val) => c(bm).add([-1, val]))
    });
  }

  gradeInvolution(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "gradeInvolution", c => {
      mv.forComponents((bm, val) => c(bm).add([...flipSign(getGrade(bm) & 1), val]))
    });
  }

  reverse(mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "reverse", c => {
      mv.forComponents((bm, val) => c(bm).add([...flipSign(getGrade(bm) & 2), val]))
    });
  }

  dual(mv: MultiVector<T>): MultiVector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
    // TODO Implement directly.
  }

  /**
   * Short for `this.scalarProduct(mv, this.reverse(mv))`.
   */
  normSquared(mv: MultiVector<T>): Factor<T> {
    this.ctx.space();
    const variable = this.ctx.makeVar("normSquared");
    mv.forComponents((bm, val) => {
      const mf = this.metricFactors(bm);
      if (mf !== null) {
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
        variable.add([...mf, val, val]);
      }
    });
    return variable.value();
  }

  norm(mv: MultiVector<T>): Factor<T> {
    return this.ctx.scalarFunc("sqrt", this.normSquared(mv));
  }

  // A note on inverse(...) and normalize(...):
  // ------------------------------------------
  // I had specialized implementations for the cases where the argument
  // had only 0 or 1 component.  But meanwhile I think these implementations
  // were no better than the generic implementations and so I have removed them.
  // TODO Have another look at the generated code for 0 or 1 component.

  /** **This is only correct for versors!** */
  inverse(mv: MultiVector<T>): MultiVector<T> {
    const norm2 = this.normSquared(mv);
    if (norm2 === 0) {
      throw `trying to invert null vector ${mv}`;
    }
    return this.scale(this.ctx.scalarFunc2("/", 1, norm2), mv);
  }

  /** **This is only correct for versors!** */
  normalize(mv: MultiVector<T>): MultiVector<T> {
    // TODO omit normalization if mv is known to be normalized
    const norm = this.norm(mv);
    if (norm === 0) {
      throw `trying to normalize null vector ${mv}`;
    }
    return this.scale(this.ctx.scalarFunc2("/", 1, norm), mv);
  }

  extractGrade(grade: number, mv: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, "extract" + grade, c => {
      mv.forComponents((bm, val) => {
        if (getGrade(bm) == grade) {
          c(bm).add([val]);
        }
      })
    });
  }

  plus(...mvs: MultiVector<T>[]): MultiVector<T> {
    return new MultiVector(this, "plus", c => {
      for (const mv of mvs) {
        mv.forComponents((bm, val) => c(bm).add([val]));
      }
    });
  }

  /** The core functionality for all kinds of products */
  private product2(kind: ProductKind, a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return new MultiVector(this, kind + "Prod", c => {
      a.forComponents((bmA, valA) => b.forComponents((bmB, valB) => {
        if (includeProduct(kind, bmA, bmB)) {
          const mf = this.metricFactors(bmA & bmB);
          if (mf !== null) {
            const sign = flipSign(productFlips(bmA, bmB) & 1);
            c(bmA ^ bmB).add([...sign, ...mf, valA, valB]);
          }
        }
      }))
    });
  }

  /** Like `product2`, but for an arbitrary number of multivectors */
  private product(kind: ProductKind, mvs: MultiVector<T>[]): MultiVector<T> {
    return mvs.length === 0
      ? new MultiVector(this, kind + "1", c => c(0).add([]))
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
    const variable = this.ctx.makeVar("scalarProd");
    a.forComponents((bm, valA) => {
      const valB = b.value(bm);
      if (valB !== 0) {
        const mf = this.metricFactors(bm);
        if (mf !== null) {
          const sign = flipSign(getGrade(bm) & 2);
          variable.add([...sign, ...mf, valA, valB]);
        }
      }
    });
    return variable.value();
  }

  /** **EXPECTS A 2-BLADE AND POSITIVE-DEFINITE METRIC** */
  exp(A: MultiVector<T>): MultiVector<T> {
    // Notice that [DFM09] p. 185 use A**2, which is -norm2 for a 2-blade.
    const norm2 = this.normSquared(A);
    if (norm2 === 0) {
      return new MultiVector(this, "expNull", c => {
        c(0).add([1]);
        A.forComponents((bm, val) => c(bm).add([val]));      
      });
    } else {
      // TODO detect and handle negative or zero norm2 at runtime
      const {ctx} = this;
      const alpha = ctx.scalarFunc("sqrt", norm2);
      const cos = ctx.scalarFunc("cos", alpha);
      const sin = ctx.scalarFunc("sin", alpha);
      const sinByAlpha = ctx.scalarFunc2("/", sin, alpha);
      return new MultiVector(this, "exp", c => {
        c(0).add([cos]);
        A.forComponents((bm, val) => c(bm).add([sinByAlpha, val]));
      });
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
    if (R2Norm == 0) throw "division by zero in log computation";
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
  
  /** **expects 1-vectors** */
  getAngle(a: MultiVector<T>, b: MultiVector<T>): Factor<T> {
    const prod = this.geometricProduct(this.normalize(a), this.normalize(b));
    return this.ctx.scalarFunc2("atan2",
      this.norm(this.extractGrade(2, prod)),
      prod.value(0)
    );
  }

  slerp(t: Factor<T>, a: MultiVector<T>, b: MultiVector<T>) {
    const {ctx} = this;
    const Omega = this.getAngle(a, b);
    return this.scale(
      ctx.scalarFunc2("/", 1, ctx.scalarFunc("sin", Omega)),
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
    );
  }
}
