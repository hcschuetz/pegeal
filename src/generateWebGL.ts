import { Term, Scalar, Context, Var, truth } from "./Algebra";

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
  constructor(
    readonly ctx: WebGLContext,
    readonly name: string
  ) {
    super();
  }

  addTerm(term: Term<string>, negate: truth, create: boolean) {
    const expr = term.length === 0 ? "1.0" : term.map(formatFactor).join(" * ");
    const signedExpr = negate ? `-(${expr})` : `  ${expr}`;
    this.ctx.emit(
      `${create ? "float" : "     "} ${this.name}  = ${signedExpr};`
    );
  }

  getValue() { return this.name; }
}

export class WebGLContext extends Context<string> {
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

  comment(text: string) {
    this.emit("// " + text);
  }
}

const binopLongName: Record<string, string> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "div",
};
