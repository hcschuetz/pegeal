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

  scalarOp(name: string, args: Scalar<string>[], options?: {nameHint?: string}) {
    const {nameHint} = options ?? {};
    let varName: string;
    if (name === "unaryMinus") {
      varName = `${nameHint ?? "minus"}_${this.count++}`;
      this.emit(`float ${varName} = -(${formatScalar(args[0])});`);
    } else if (Object.hasOwn(multiOpLongName, name)) {
      varName = `${nameHint ?? multiOpLongName[name]}_${this.count++}`;
      this.emit(`float ${varName} = ${args.map(formatScalar).join(` ${name} `)};`);
    } else if (Object.hasOwn(binopLongName, name)) {
      varName = `${nameHint ?? binopLongName[name]}_${this.count++}`;
      this.emit(`float ${varName} = ${formatScalar(args[0])} ${name} ${formatScalar(args[1])};`);
    } else {
      varName = `${nameHint ?? name}_${this.count++}`;
      this.emit(`float ${varName} = ${name}(${args.map(formatScalar).join(", ")});`);
    }
    return varName;
  }

  comment(text: string) {
    this.emit("// " + text);
  }
}

const multiOpLongName: Record<string, string> = {
  "+": "plus",
  "*": "times",
};

const binopLongName: Record<string, string> = {
  "-": "minus",
  "/": "div",
};
