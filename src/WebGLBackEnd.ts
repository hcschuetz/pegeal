import { Scalar, BackEnd } from "./Algebra";

function formatScalar(f: Scalar<string>): string {
  switch (typeof f) {
    case "number": {
      const s = f.toString();
      return s + (/\.|e/i.test(s) ? "" : ".0");  
    }
    case "string": return f;
  }
}

export default class WebGLBackEnd implements BackEnd<string> {
  private count = 0;
  public text = "";

  emit(newText: string) {
    this.text += newText + "\n";
  }

  scalarOp(name: string, ...args: Scalar<string>[]) {
    let varName: string
    if (name === "unaryMinus") {
      varName = `minus_${this.count++}`;
      this.emit(`float ${varName} = -(${formatScalar(args[0])});`);
    } else if (Object.hasOwn(binopLongName, name)) {
      varName = `${binopLongName[name]}_${this.count++}`;
      this.emit(`float ${varName} = ${formatScalar(args[0])} ${name} ${formatScalar(args[1])};`);
    } else {
      varName = `${name}_${this.count++}`;
      this.emit(`float ${varName} = ${name}(${args.map(formatScalar).join(", ")});`);
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
