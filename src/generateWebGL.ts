import { Term, Scalar, Context, Var } from "./Algebra";

function formatFactor(f: Scalar<string>): string {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

class VarImpl extends Var<string> {
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
      this.#numericPart += term.reduce((x, y) => x * y, negate ? -1 : 1);
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

  freeze(): void {
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

  emit(newText: string) {
    this.text += newText + "\n";
  }

  makeVar(nameHint: string) {
    return new VarImpl(this, `${nameHint}_${this.count++}`);
  }

  scalarOp(name: string, ...args: Scalar<string>[]) {
    let varName: string
    if (Object.hasOwn(binopLongName, name)) {
      varName = `${binopLongName[name]}_${this.count++}`;
      this.emit(`\nfloat ${varName} = ${formatFactor(args[0])} ${name} ${formatFactor(args[1])};`);
    } else {
      varName = `${name}_${this.count++}`;
      this.emit(`\nfloat ${varName} = ${name}(${args.map(formatFactor).join(", ")});`);
    }
    return varName;
  }

  space() {
    this.emit("");
  }
}

const binopLongName: Record<string, string> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "div",
};
