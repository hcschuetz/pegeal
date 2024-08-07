import { type MultiVector, type Term, type Factor, type Scalar, AbstractScalar } from "./Algebra.ts";
import { AbstractContext } from "./ContextUtils.ts";

class ScalarImpl extends AbstractScalar<never> {
  value: number | undefined = undefined;
  readonly context: EvalContext;

  constructor(
    context: EvalContext
  ) {
    super();
    this.context = context;
  }

  add0(term: Term<never>): this {
    this.value = (this.value ?? 0) + term.reduce((x, y) => x*y, 1);
    return this;
  }

  get0(): Factor<never> | undefined { return this.value; }

  toJSON() { return this.value; }
  toString() { return JSON.stringify(this); }
}

class MultiVectorImpl implements MultiVector<never> {
  /**
   * A sparse array mapping each possibly non-zero component (expressed as a
   * bitmap) of this multivector to the component's magnitude.
   */
  components: number[] = [];
  readonly context: EvalContext;

  constructor(
    context: EvalContext
  ) {
    this.context = context;
  }

  add(bm: number, term: Term<never>): this {
    this.components[bm] = (this.components[bm] ?? 0) + term.reduce((x, y) => x*y, 1)
    return this;
  }

  forComponents(callback: (bitmap: number, value: Factor<never>) => unknown): void {
    this.components.forEach((val, bm) => callback(bm, val));
  }

  get(bm: number): number | undefined { return this.components[bm]; }

  toJSON(): Record<string, number> {
    const result: Record<string, number> = {};
    this.forComponents((bm, val) => result[this.context.bitmapToString[bm]] = val);
    return result;
  }

  toString() { return JSON.stringify(this); }
}

export class EvalContext extends AbstractContext<never> {
  makeScalar(nameHint: string): Scalar<never> {
    return new ScalarImpl(this);
  }

  makeMultiVector(): MultiVector<never> {
    return new MultiVectorImpl(this);
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

  invertFactor(f: number): Factor<never> {
    return 1 / f;
  }
}
