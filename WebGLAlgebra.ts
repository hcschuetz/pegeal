// TODO ##################################################
// - Emit more structure from MultiVectorImpl and let context.emit() do the
//   text formatting.
// - Replace MultiVectorImpl.coords by a list of bitmaps.
//   In the operator implementations this can be 
// - Support explicit naming?
// - Move unary and binary operators from Algebra to MultiVectorImpl?
// - Support assignments and multiple paths.
//   (How?  Is this something for the context?)

import { MultiVector, Algebra } from "./Algebra";


export interface Context {
  uniqueIdentifier(base: string): string;
  emit(newText: string): void;
}

const negateVal = (value: string) => `-(${value})`;

/**
 * Return `val` or its negative, depending on the `negate` flag.
 * For convenience take a number as the flag.
 */
const signed = (negate: number, val: string) => negate ? negateVal(val) : val;

class MultiVectorImpl implements MultiVector {
  coords: string[] = [];

  constructor(
    readonly alg: AlgebraImpl,
    private name: string
  ) {
    alg.context.emit("");
  }

  get(key: number | string) {
    return this.coords[typeof key === "number" ? key : this.alg.coordToBitmap[key]];
  }

  /**
   * Emit code that adds/subtracts `value` to/from the component identified
   * by the bitmap `bm`.
   * Returns `this` to provide a fluent interface.
   */
  addToCoord(bm: number, value: string) {
    let coordVar = this.coords[bm];
    if (coordVar === undefined) {
      this.coords[bm] = coordVar = `${this.name}_${this.alg.bitmapToCoord[bm]}`;
      this.alg.context.emit(`float ${coordVar} = ${value};`);
    } else {
      this.alg.context.emit(`      ${coordVar} += ${value};`);
    }
    return this;
  }

  toString() {
    return `${this.name}{${
      this.coords
      .map((v, bm) => `${this.alg.bitmapToCoord[bm]}: ${v}`)
      .filter(v => v)
      .join(", ")
    }}`;
  }
}

// TODO Precompute and tabulate baseBladeGrade, wedgeFlips, and contractFlips?
// (Tables for the binary operations may get large for higher dimensions.)

// See https://graphics.stanford.edu/%7Eseander/bithacks.html#CountBitsSetNaive
// and subsequent solutions for alternative implementations.
function baseBladeGrade(bitmap: number) {
  let result = 0;
  for (let bit = 1; bit <= bitmap; bit <<=1) {
    if (bit & bitmap) {
      result++;
    }
  }
  return result;
}

/**
 * Get the number of adjacent transpositions for the wedge product or
 * geometric product of two base blades.
 */
function prodFlips(bitmapA: number, bitmapB: number): number {
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

// TODO use this
function applyMetric(bitmap: number, metric: number[]) {
  if (bitmap) {
    let metricFactor = 1;
    for (let bit = 1, i = 0; bit <= bitmap; bit <<= 1, i++) {
      if (bit & bitmap) {
        // TODO Support symbolic metrics.  `metric[i]` can be a variable.
        // Return a list of numbers and variables.
        metricFactor *= metric[i];
      }
    }
    return metricFactor;
  }
}

export class AlgebraImpl implements Algebra {
  // TODO linear mappings and outermorphisms
  // TODO configurable non-Euclidian metrics
  // TODO geometric product
  // TODO reflections and rotations
  // TODO? blades and versors (in addition to multivectors)

  bitmapToCoord: string[] = [];
  coordToBitmap: Record<string, number> = {};

  constructor(
    readonly context: Context,
    readonly dimension: number,
    // public metric: number[],
    mkCoord: (bm: number) => string
  ) {
    const { bitmapToCoord, coordToBitmap } = this;
    const multiDimension = 1 << dimension;
    for (let bm = 0; bm < multiDimension; bm++) {
      const coord = mkCoord(bm);
      bitmapToCoord[bm] = coord;
      coordToBitmap[coord] = bm;
    }
  }

  makeMV(baseName: string): MultiVectorImpl {
    return new MultiVectorImpl(this, this.context.uniqueIdentifier(baseName));
  }

  zero() {
    return this.makeMV("zero");
  }

  one() {
    return this.makeMV("one").addToCoord(0, "1.0");
  }

  pseudoScalar() {
    return this.makeMV("pseudoScalar")
      .addToCoord((1 << this.dimension) - 1, "1.0");
  }

  pseudoScalarInv() {
    return this.makeMV("pseudoScalarInv")
      // TODO check if the sign is what we need
      .addToCoord((1 << this.dimension) - 1, signed(this.dimension & 2, "1.0"));
  }

  basis() {
    return new Array(this.dimension).fill(undefined).map((_, i) =>
      this.makeMV("basis" + i).addToCoord(1 << i, "1.0")
    );
  }

  mv(obj: Record<string, string>) {
    const result = this.makeMV("mv");
    for (const [k, v] of Object.entries(obj)) {
      const bm = this.coordToBitmap[k];
      if (bm === undefined) {
        throw `unexpected key "${k}" in mv(${JSON.stringify(obj)})`;
      }
      result.addToCoord(bm, v);
    }
    return result;
  }

  /** Ensure that the `MultiVector` is actually from this `Algebra` instance. */
  checkMine(mv: MultiVector): void {
    if (!(mv instanceof MultiVectorImpl && mv.alg === this)) {
      throw `cannot handle multivector ${mv} from another algebra`;
      // Well, technically we might even be able to handle the foreign
      // multivector, but semantically this is probably nonsense.
      // For those cases where it does make sense, we should have an explicit
      // conversion operation.
    }
  }

  scale(alpha: string, mv: MultiVector): MultiVector {
    this.checkMine(mv);
    const result = this.makeMV("scale");
    mv.coords.forEach((v, k) => {
      result.addToCoord(k, `(${alpha}) * ${v}`);
    });
    return result;
  }

  negate(mv: MultiVector) {
    this.checkMine(mv);
    const result = this.makeMV("negate");
    mv.coords.forEach((v, k) => {
      result.addToCoord(k, negateVal(v));
    });
    return result;
  }

  gradeInvolution(mv: MultiVector) {
    this.checkMine(mv);
    const result = this.makeMV("gradeInvol");
    mv.coords.forEach((v, k) => {
      result.addToCoord(k, signed(baseBladeGrade(k) & 1, v));
    });
    return result;
  }

  reverse(mv: MultiVector) {
    this.checkMine(mv);
    const result = this.makeMV("reverse");
    mv.coords.forEach((v, k) => {
      result.addToCoord(k, signed(baseBladeGrade(k) & 2, v));
    });
    return result;
  };

  dual(mv: MultiVector) {
    this.checkMine(mv);

    return this.contract(mv, this.pseudoScalarInv());

    // // Implement duality "directly", i.e., coordinate-based?
    // const result = this.makeMV("dual");
    // mv.coords.forEach((v, k) => {
    //   // TODO tweak sign?
    //   result.addToCoord(((1 << this.dimension) - 1) & ~k, v);
    // });
    // return result;
  };

  extractGrade(grade: number, mv: MultiVector) {
    this.checkMine(mv);
    const result = this.makeMV("extract" + grade);
    mv.coords.forEach((v, k) => {
      if (baseBladeGrade(k) === grade) {
        result.addToCoord(k, v);
      }
    });
    return result;
  }

  plus(...mvs: MultiVector[]): MultiVector {
    const result = this.makeMV("plus");
    for (const mv of mvs) {
      this.checkMine(mv);
      mv.coords.forEach((v, k) => {
        result.addToCoord(k, v);
      });
    }
    return result;
  }

  private prod2(geom: boolean, a: MultiVector, b: MultiVector) {
    const result = this.makeMV(geom ? "geom" : "wedge");
    a.coords.forEach((va, ka) => {
      b.coords.forEach((vb, kb) => {
        const duplicates = ka & kb;
        if (geom || !duplicates) {
          // TODO apply metric factor for duplicates
          result.addToCoord(ka ^ kb, signed(prodFlips(ka, kb) & 1, `${va} * ${vb}`));
        }
      });
    });
    return result;
  }

  private prod(geom: boolean, mvs: MultiVector[]): MultiVector {
    mvs.forEach(mv => this.checkMine(mv));
    if (mvs.length === 0) {
      const result = this.makeMV(geom ? "geom0" : "wedge0");
      result.addToCoord(0, "1.0");
      return result;
    }
    let result = mvs[0];
    for (const mv of mvs.slice(1)) {
      result = this.prod2(geom, result, mv);
    }
    return result;
  }

  wedge(...mvs: MultiVector[]): MultiVector {
    return this.prod(false, mvs);
  }

  geomProd(...mvs: MultiVector[]): MultiVector {
    return this.prod(true, mvs);
  }

  contract(a: MultiVector, b: MultiVector): MultiVector {
    this.checkMine(a);
    this.checkMine(b);
    const result = this.makeMV("contract");
    a.coords.forEach((va, ka) => {
      b.coords.forEach((vb, kb) => {
        if (!(ka & ~kb)) {
          // TODO apply metric factor for ka
          result.addToCoord(kb & ~ka, signed(prodFlips(ka, kb) & 1, `${va} * ${vb}`));
        }
      });
    });
    return result;
  }

  scalarProd(a: MultiVector, b: MultiVector): MultiVector {
    this.checkMine(a);
    this.checkMine(b);
    const result = this.makeMV("scalarProd");
    a.coords.forEach((va, ka) => {
      const vb = b.coords[ka];
      if (vb !== undefined) {
          // TODO apply metric factor for ka
          result.addToCoord(0, signed(prodFlips(ka, ka) & 1, `${va} * ${vb}`));
      }
    });
    return result;
  }
}
