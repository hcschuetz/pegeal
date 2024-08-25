import { Term, Factor, ScalarFuncName, ScalarFunc2Name, Var, Context } from "./Algebra";

function formatFactor(f: Factor<string>) {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

class VarImpl implements Var<string> {
  created = false;

  constructor(
    readonly ctx: WebGLContext,
    readonly name: string
  ) {}

  add(term: Term<string>) {
    const expr = term.length === 0 ? "1.0" : term.map(formatFactor).join(" * ");
    this.ctx.emit(
      !this.created
      ? `float ${this.name}  = ${expr};`
      : `      ${this.name} += ${expr};`
    );
    this.created = true;
  }

  value() {
    return this.created ? this.name : 0;
  }
}

export class WebGLContext implements Context<string> {
  private count = 0;
  public text = "";

  emit(newText: string) {
    this.text += newText + "\n";
  }

  space() {
    this.emit("");
  }

  makeVar(nameHint: string) {
    return new VarImpl(this, `${nameHint}_${this.count++}`);
  }

  invertFactor(f: Factor<string>) {
    const varName: string = `inv_${this.count++}`;
    this.emit(`\nfloat ${varName} = 1.0 / ${formatFactor(f)};`);
    return varName;
  }

  scalarFunc(name: ScalarFuncName, f: Factor<string>) {
    const varName = `${name}_${this.count++}`;
    this.emit(`\nfloat ${varName} = ${name}(${formatFactor(f)});`);
    return varName;
  }

  scalarFunc2(name: ScalarFunc2Name, f1: Factor<string>, f2: Factor<string>) {
    const varName = `${scalarFunc2LongName[name]}_${this.count++}`;
    const expr = /^[a-z]/i.test(name)
      ? `${name}(${formatFactor(f1)}, ${formatFactor(f2)})`
      : `${formatFactor(f1)} ${name} ${formatFactor(f2)}`;
    this.emit(`\nfloat ${varName} = ${expr};`);
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
