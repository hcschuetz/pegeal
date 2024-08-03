import { MultiVector, Term, Factor, Scalar, AbstractScalar } from "./Algebra";
import { AbstractContext } from "./ContextUtils";

function formatFactor(f: Factor<string>) {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

class ScalarImpl extends AbstractScalar<string> {
  haveVariable = false;

  constructor(
    readonly context: WebGLContext,
    readonly name: string,
  ) {
    super();
    context.emit(`\n// ${name}:`);
  }

  add0(term: Term<string>): this {
    const termString =
      term.length === 0 ? "1.0" : term.map(formatFactor).join(" * ");
    if (!this.haveVariable) {
      this.context.emit(`float ${this.name}  = ${termString};`);
      this.haveVariable = true;
    } else {
      this.context.emit(`      ${this.name} += ${termString};`);
    }
    return this;
  }

  get0(): Factor<string> | undefined {
    return this.haveVariable ? this.name : undefined;
  }

  toString() { return `${this.get0()}`; }
}

class MultiVectorImpl implements MultiVector<string> {
  /**
   * A sparse array mapping each possibly non-zero component (expressed as a
   * bitmap) of this multivector to the WebGL variable name holding the
   * component's magnitude.
   */
  components: string[] = [];

  constructor(
    readonly context: WebGLContext,
    readonly name: string
  ) {
    context.emit(`\n// ${name}:`);
  }

  add(bm: number, term: Term<string>): this {
    const termString =
      term.length === 0 ? "1.0" : term.map(formatFactor).join(" * ");
    let component = this.components[bm];
    if (!component) {
      this.components[bm] = component =
        `${this.name}_${this.context.bitmapToString[bm]}`;
      this.context.emit(`float ${component}  = ${termString};`);
    } else {
      this.context.emit(`      ${component} += ${termString};`);
    }
    return this;
  }

  forComponents(callback: (bitmap: number, value: string) => unknown): void {
    this.components.forEach((val, bm) => callback(bm, val));
  }

  get(bm: number) { return this.components[bm]; }

  toString() {
    return `${this.name}{${
      this.components
      .map((val, bm) => `${this.context.bitmapToString[bm]}: ${val}`)
      .filter(val => val !== undefined)
      .join(", ")
    }}`;
  }
}

export class WebGLContext extends AbstractContext<string> {
  private count = 0;
  public text = "";

  emit(newText: string) {
    this.text += newText + "\n";
  }

  makeScalar(nameHint: string): Scalar<string> {
    return new ScalarImpl(this, `${nameHint}_${this.count++}`);
  }

  makeMultiVector(nameHint: string): MultiVector<string> {
    return new MultiVectorImpl(this, `${nameHint}_${this.count++}`);
  }

  mv(nameHint: string, obj: Record<string, string>): MultiVector<string> {
    const result = this.makeMultiVector(nameHint);
    Object.entries(obj).forEach(([key, val]) => {
      const bm = this.stringToBitmap[key];
      if (bm === undefined) {
        throw `unexpected key in mv data: ${key}`;
      }
      result.add(bm, [val]);
    })
    return result;
  }

  invertFactor(f: Factor<string>): Factor<string> {
    const varName: string = `inv_${this.count++}`;
    this.emit(`\n// ${varName}:`);
    this.emit(`float ${varName} = 1.0 / ${formatFactor(f)};`);
    return varName;
  }
}
