import { Term, Scalar, BackEnd, Var, truth } from "./Algebra";

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
    readonly be: WebGLBackEnd,
    readonly name: string
  ) {
    super();
  }

  addValue(val: Scalar<string>, negate: truth, create: boolean) {
    const expr = formatFactor(val);
    const signedExpr = negate ? `-(${expr})` : `  ${expr}`;
    this.be.emit(
      create
      ? `float ${this.name}  = ${signedExpr};`
      : `      ${this.name} += ${signedExpr};`,
    );
  }

  getValue() { return this.name; }
}

export default class WebGLBackEnd extends BackEnd<string> {
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
      this.emit(`float ${varName} = ${formatFactor(args[0])} ${name} ${formatFactor(args[1])};`);
    } else {
      varName = `${name}_${this.count++}`;
      this.emit(`float ${varName} = ${name}(${args.map(formatFactor).join(", ")});`);
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
