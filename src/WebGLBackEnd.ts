import { Scalar, BackEnd, ScalarOpOptions } from "./Algebra";

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

  scalarOp(op: string, args: Scalar<string>[], options?: ScalarOpOptions) {
    const expr =
      op === "unaryMinus"
      ? `- ${formatScalar(args[0])}`
      : Object.hasOwn(multiOpLongName, op)
      ? args.map(formatScalar).join(` ${op} `)
      : Object.hasOwn(binopLongName, op)
      ? `${formatScalar(args[0])} ${op} ${formatScalar(args[1])}`
      : `${op}(${args.map(formatScalar).join(", ")})`;
    if (options?.named) {
      const varName = `${options.named}_${this.count++}`;
      this.emit(`float ${varName} = ${expr};`);
      return varName;
    } else {
      return `(${expr})`;
    }
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
