import { Scalar, BackEnd, fail } from "./Algebra";

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

  scalarOp(opName: string, args: Scalar<string>[], options?: {nameHint?: string}) {
    const [baseName, expr, correctNArgs] =
      opName === "unaryMinus" ? [
        "minus",
        `-(${formatScalar(args[0])})`,
        args.length === 1,
      ] :
      Object.hasOwn(multiOpLongName, opName) ? [
        multiOpLongName[opName],
        args.map(formatScalar).join(` ${opName} `),
        args.length >= 1,
      ] :
      Object.hasOwn(binopLongName, opName) ? [
        binopLongName[opName],
        `${formatScalar(args[0])} ${opName} ${formatScalar(args[1])}`,
        args.length === 2,
      ] :
      [
        opName,
        `${opName}(${args.map(formatScalar).join(", ")});`,
        opName === "atan2" ? args.length === 2 :
        opName === "max" ? args.length >= 1 :
        args.length === 1,
      ];
    if (!correctNArgs) {
      fail(`Unexpected number of arguments for "${opName}": ${args.length}`);
    }
    const varName = `${options?.nameHint ?? baseName}_${this.count++}`;
    this.emit(`float ${varName} = ${expr};`);
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
