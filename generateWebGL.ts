import { Term, Factor, Var, Context, BinOp, AbstractVar } from "./Algebra";
import { EvalContext } from "./evalExpr";

function formatFactor(f: Factor<string>): string {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

class VarImpl extends AbstractVar<string> {
  #created = false;
  #numericPart = 0;

  constructor(
    readonly ctx: WebGLContext,
    readonly name: string
  ) {
    super();
  }

  addImpl(term: Term<string>, negate = false) {
    if (term.some(f => f === 0)) return;

    // We could easily eliminate 1 factors:
    //   term = term.filter(f => f !== 1);
    // but keeping them might make the generated code more readable,
    // and it should be easy for that code's compiler to optimize 1s away.

    if (term.every(f => typeof f === "number")) {
      this.#numericPart += term.reduce((x, y) => x * y, 1);
      return;
    }

    const expr = term.length === 0 ? "1.0" : term.map(formatFactor).join(" * ");
    const signedExpr = negate ? `-(${expr})` : `  ${expr}`;
    this.ctx.emit(
      !this.#created
      ? `float ${this.name}  = ${signedExpr};`
      : `      ${this.name} += ${signedExpr};`
    );
    this.#created = true;
  }

  onFreeze(): void {
    if (this.#created && this.#numericPart !== 0) {
      this.ctx.emit(`      ${this.name} += ${formatFactor(this.#numericPart)};`);
    }
  }

  valueImpl() {
    return this.#created ? this.name : this.#numericPart;
  }
}

export class WebGLContext implements Context<string> {
  private count = 0;
  public text = "";
  private evalCtx = new EvalContext();

  emit(newText: string) {
    this.text += newText + "\n";
  }

  makeVar(nameHint: string) {
    return new VarImpl(this, `${nameHint}_${this.count++}`);
  }

  scalarFunc(name: string, ...args: Factor<string>[]) {
    // If the actual value of f is known, evaluate the function call at
    // code-generation time.  Most of the time we could simply leave this
    // optimization to the WebGL compiler.  But occasionally it helps to
    // evaluate such calls here:
    // - Detect NaN and infinity in the generated code, not at runtime.
    // - Certain results (typially 0 or 1) may allow for further optimizations
    //   by the code generator.
    if (args.every(arg => typeof arg === "number")) {
      return this.evalCtx.scalarFunc(name, ...args);
    }

    const varName = `${name}_${this.count++}`;
    this.emit(`\nfloat ${varName} = ${name}(${args.map(formatFactor).join(", ")});`);
    return varName;
  }

  binop(name: BinOp, f1: Factor<string>, f2: Factor<string>) {
    // See the comment at the beginning of scalarFunc(...).
    if (typeof f1 === "number" && typeof f2 === "number") {
      return this.evalCtx.binop(name, f1, f2);
    }

    const varName = `${binopLongName[name]}_${this.count++}`;
    this.emit(`\nfloat ${varName} = ${formatFactor(f1)} ${name} ${formatFactor(f2)};`);
    return varName;
  }

  space() {
    this.emit("");
  }
}

const binopLongName: Record<BinOp, String> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "div",
};
