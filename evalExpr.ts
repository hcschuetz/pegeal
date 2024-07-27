import { MultiVector, Term, Context, bitList, Factor } from "./Algebra";

class MultiVectorImpl implements MultiVector<never> {
  /**
   * A sparse array mapping each possibly non-zero component (expressed as a
   * bitmap) of this multivector to the component's magnitude.
   */
  components: number[] = [];

  constructor(
    readonly bitmapToString: string[],
  ) {}

  add(bm: number, term: Term<never>): this {
    this.components[bm] = (this.components[bm] ?? 0) + term.reduce((x, y) => x*y, 1)
    return this;
  }

  forComponents(callback: (bitmap: number, value: Factor<never>) => unknown): void {
    this.components.forEach((val, bm) => callback(bm, val));
  }

  get(bm: number): number { return this.components[bm]; }

  toJSON(): Record<string, number> {
    const result: Record<string, number> = {};
    this.forComponents((bm, val) => result[this.bitmapToString[bm]] = val);
    return result;
  }

  toString() {
    return JSON.stringify(this);
  }
}

export class EvalContext implements Context<never> {
  readonly bitmapToString: string[] = [];
  readonly stringToBitmap: Record<string, number> = {};

  constructor(
    readonly coordinates: string[],
  ) {
    const nMultiDimensions = 1 << coordinates.length;
    for (let bm = 0; bm < nMultiDimensions; bm++) {
      const name = bitList(bm).map(i => this.coordinates[i]).join("") || "1";
      this.bitmapToString[bm] = name;
      this.stringToBitmap[name] = bm;
    }
  }

  makeMultiVector(): MultiVector<never> {
    return new MultiVectorImpl(this.bitmapToString);
  }
  mv(obj: Record<string, number>): MultiVector<never> {
    const result = this.makeMultiVector();
    Object.entries(obj).forEach(([key, val]) => {
      const bm = this.stringToBitmap[key];
      if (bm === undefined) {
        throw `unexpected key in mv data: ${key}`;
      }
      result.add(bm, [val]);
    })
    return result;
  }
}
