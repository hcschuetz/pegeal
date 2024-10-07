import { Scalar, BackEnd, BEVariable } from "./Algebra";

function formatFactor(f: Scalar<string>): string {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

class WebGLVar implements BEVariable<string> {
  #created = false;

  constructor(
    readonly be: WebGLBackEnd,
    readonly name: string
  ) {}

  add(val: Scalar<string>) {
    const expr = formatFactor(val);
    this.be.emit(
      !this.#created
      ? `float ${this.name}  = ${expr};`
      : `      ${this.name} += ${expr};`,
    );
    this.#created = true;
  }

  value() { return this.name; }
}

export default class WebGLBackEnd implements BackEnd<string> {
  private count = 0;
  public text = "";

  emit(newText: string) {
    this.text += newText + "\n";
  }

  makeVar(nameHint: string) {
    return new WebGLVar(this, `${nameHint}_${this.count++}`);
  }

  scalarOp(name: string, ...args: Scalar<string>[]) {
    let varName: string
    if (name === "unaryMinus") {
      varName = `minus_${this.count++}`;
      this.emit(`float ${varName} = -(${formatFactor(args[0])});`);
    } else if (Object.hasOwn(binopLongName, name)) {
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
