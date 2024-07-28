export type Factor<T> = number | T;
export type Term<T> = Factor<T>[];

export interface MultiVector<T> {
  add(bm: number, term: Term<T>): this;
  forComponents(callback: (bitmap: number, value: Factor<T>) => unknown): unknown;
  get(bm: number): Factor<T>;
}

export interface Context<T> {
  makeMultiVector(nameHint: string): MultiVector<T>;
}


/** For each 1 bit in the bitmap, invoke the callback with the bit position. */
function forBitmap(bm: number, callback: (direction: number) => unknown): void {
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
function getGrade(bitmap: number) {
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
function productFlips(bitmapA: number, bitmapB: number): number {
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

const flipSign = (doFlip: number) => doFlip ? -1 : 1;

function addTerm<T>(mv: MultiVector<T>, bm: number, term: Term<T>): MultiVector<T> {
  if (term.every(f => f !== 0)) {
    mv.add(bm, term.filter(f => f !== 1)); // remove 1s just for readability
    // TODO multiply the numeric factors?
  }
  return mv;
}

export class Algebra<T> {
  readonly nDimensions: number;
  readonly fullBitmap: number;

  constructor(
    readonly metric: Factor<T>[],
    readonly ctx: Context<T>,
  ) {
    this.nDimensions = metric.length;
    this.fullBitmap = (1 << metric.length) - 1;
  }

  zero(): MultiVector<T> {
    return this.ctx.makeMultiVector("zero");
  };
  one(): MultiVector<T> {
    return this.ctx.makeMultiVector("one").add(0, []);
  }
  pseudoScalar(): MultiVector<T> {
    return this.ctx.makeMultiVector("ps").add(this.fullBitmap, []);
  }
  pseudoScalarInv(): MultiVector<T> {
    return this.ctx.makeMultiVector("psInv").add(this.fullBitmap, [
      flipSign(this.nDimensions & 2) // TODO check if this is correct
    ]);
  }
  basisVectors(): MultiVector<T>[] {
    return this.metric.map((_, i) =>
      this.ctx.makeMultiVector("basis" + i). add(1 << i, [])
    )
  }

  // TODO Move the methods taking a single MultiVector to the MultiVector class?

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: Factor<T>, mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("scale");
    mv.forComponents((bm, val) => addTerm(result, bm, [alpha, val]));
    return result;
  }

  negate(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("scale");
    mv.forComponents((bm, val) => result.add(bm, [-1, val]));
    return result;
  }

  gradeInvolution(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("scale");
    mv.forComponents((bm, val) => result.add(bm, [flipSign(bm & 1), val]));
    return result;
  }

  reverse(mv: MultiVector<T>): MultiVector<T> {
    const result = this.ctx.makeMultiVector("reverse");
    mv.forComponents((bm, val) => result.add(bm, [flipSign(bm & 2), val]));
    return result;
  }

  dual(mv: MultiVector<T>): MultiVector<T> {
    return this.contractLeft(mv, this.pseudoScalarInv());
    // TODO implement directly
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
        addTerm(result, bmA ^ bmB, [
          flipSign(productFlips(bmA, bmB) & 1),
          ...bitList(bmA & bmB).map(i => this.metric[i]),
          valA,
          valB,
        ]);
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

  scalarProduct(a: MultiVector<T>, b: MultiVector<T>): MultiVector<T> {
    return this.product2("scalar", a, b);
  }
}
