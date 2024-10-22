import { Scalar, BackEnd, fail, ScalarOpOptions } from "./Algebra";

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
    const [expr, correctNArgs] =
      op === "unaryMinus" ? [
        `- ${formatScalar(args[0])}`,
        args.length === 1,
      ] :
      Object.hasOwn(multiOpLongName, op) ? [
        args.map(formatScalar).join(` ${op} `),
        args.length >= 1,
      ] :
      Object.hasOwn(binopLongName, op) ? [
        `${formatScalar(args[0])} ${op} ${formatScalar(args[1])}`,
        args.length === 2,
      ] :
      [
        `${op}(${args.map(formatScalar).join(", ")})`,
        op === "atan2" ? args.length === 2 :
        op === "max" ? args.length >= 1 :
        args.length === 1,
      ];
    if (!correctNArgs) {
      fail(`Unexpected number of arguments for "${op}": ${args.length}`);
    }
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
