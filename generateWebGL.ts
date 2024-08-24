import { MultiVector, Term, Factor, ScalarFuncName, ScalarFunc2Name } from "./Algebra";
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

  add(bm: number, term: Term<string>) {
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

  forComponents(callback: (bitmap: number, value: string) => unknown) {
    this.components.forEach((val, bm) => callback(bm, val));
  }

  get(bm: number) { return this.components[bm] ?? 0; }

  toString() {
    return `${this.name}{${
      this.components
      .map((val, bm) => `${this.context.bitmapToString[bm]}: ${val}`)
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

  makeMultiVector(nameHint: string) {
    return new MultiVectorImpl(this, `${nameHint}_${this.count++}`);
  }

  mv(nameHint: string, obj: Record<string, Factor<string>>) {
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

  invertFactor(f: Factor<string>) {
    const varName: string = `inv_${this.count++}`;
    this.emit(`\n// ${varName}:`);
    this.emit(`float ${varName} = 1.0 / ${formatFactor(f)};`);
    return varName;
  }

  scalarFunc(name: ScalarFuncName, f: Factor<string>) {
    const varName: string = `${name}_${this.count++}`;
    this.emit(`\n// ${varName}:`);
    this.emit(`float ${varName} = ${name}(${formatFactor(f)});`);
    return varName;
  }

  scalarFunc2(name: ScalarFunc2Name, f1: Factor<string>, f2: Factor<string>) {
    const varName: string = `${scalarFunc2LongName[name]}_${this.count++}`;
    this.emit(`\n// ${varName}:`);
    const expr = /^[a-z]/i.test(name)
      ? `${name}(${formatFactor(f1)}, ${formatFactor(f2)})`
      : `${formatFactor(f1)} ${name} ${formatFactor(f2)}`;
    this.emit(`float ${varName} = ${expr};`);
    return varName;
  }
}

const scalarFunc2LongName: Record<ScalarFunc2Name, String> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "div",
  "atan2": "atan2",
};
