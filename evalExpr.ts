import { MultiVector, Term, Factor, AbstractScalar, ScalarFuncName, ScalarFunc2Name } from "./Algebra";
import { AbstractContext } from "./ContextUtils";

class ScalarImpl extends AbstractScalar<never> {
  value: number | undefined = undefined;

  constructor(
    readonly context: EvalContext,
  ) {
    super();
  }

  set0(value: Factor<never>) {
    this.value = value;
    return this;
  }

  add0(term: Term<never>) {
    this.value = (this.value ?? 0) + term.reduce((x, y) => x*y, 1);
    return this;
  }

  get0() { return this.value; }

  toJSON() { return this.value; }
  toString() { return JSON.stringify(this); }
}

class MultiVectorImpl implements MultiVector<never> {
  /**
   * A sparse array mapping each possibly non-zero component (expressed as a
   * bitmap) of this multivector to the component's magnitude.
   */
  components: number[] = [];

  constructor(
    readonly context: EvalContext
  ) {}

  set(bm: number, val: Factor<never>) {
    this.components[bm] = val;
    return this;
  }

  add(bm: number, term: Term<never>) {
    this.components[bm] = (this.components[bm] ?? 0) + term.reduce((x, y) => x*y, 1);
    return this;
  }

  forComponents(callback: (bitmap: number, value: Factor<never>) => unknown) {
    this.components.forEach((val, bm) => callback(bm, val));
  }

  get(bm: number) { return this.components[bm]; }

  toJSON() {
    const result: Record<string, number> = {};
    this.forComponents((bm, val) => result[this.context.bitmapToString[bm]] = val);
    return result;
  }

  toString() { return JSON.stringify(this); }
}

export class EvalContext extends AbstractContext<never> {
  makeScalar(nameHint: string) {
    return new ScalarImpl(this);
  }

  makeMultiVector() {
    return new MultiVectorImpl(this);
  }
  mv(obj: Record<string, number>) {
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

  invertFactor(f: number) {
    return 1 / f;
  }

  scalarFunc(name: ScalarFuncName, f: number) {
    return Math[name](f);
  }

  scalarFunc2(name: ScalarFunc2Name, f1: number, f2: number): number {
    switch (name) {
      case "+": return f1 + f2;
      case "-": return f1 - f2;
      case "*": return f1 * f2;
      case "/": return f1 / f2;
      case "atan2": return Math.atan2(f1, f2);
    }
  }
}
