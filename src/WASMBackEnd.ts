import B from "binaryen";
import { Scalar, BackEnd, ScalarOpOptions } from "./Algebra";

export class Expression {
  constructor(readonly generate: () => B.ExpressionRef) {}
}

export default class WASMBackEnd implements BackEnd<Expression> {
  varCount = 0;
  body: B.ExpressionRef[] = [];
  paramsByHint: Record<string, Expression> = {};

  constructor(
    readonly mod: B.Module,
    readonly paramHints: string[],
  ) {
    for (const hint of paramHints) {
      const varNum = this.varCount++;
      this.paramsByHint[hint] = new Expression(() => this.mod.local.get(varNum, B.f64));
    }
  }

  get paramCount() { return this.paramHints.length; }

  /**
   * `convertScalar` is a bound function so that it can be used as
   * `[...].map(this.convertScalar)`
   */
  convertScalar = (f: Scalar<Expression>): B.ExpressionRef => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return f.generate();
    }
  }

  scalarOp(name: string, args: Scalar<Expression>[], options?: ScalarOpOptions) {
    const {mod, convertScalar} = this;
    const generateExpr = () =>
      name === "unaryMinus"
      ? mod.f64.neg(convertScalar(args[0]))
      : Object.hasOwn(binopName, name)
      ? mod.f64[binopName[name]](convertScalar(args[0]), convertScalar(args[1]))
      : Object.hasOwn(multiopName, name)
      ? args.slice(1).reduce(
          (acc: B.ExpressionRef, arg: Scalar<Expression>) =>
            mod.f64[multiopName[name]](acc, convertScalar(arg)),
          convertScalar(args[0]),
        )
      : mod.call(name, args.map(convertScalar), B.f64)
    if (options?.inline) return new Expression(generateExpr);
    const varNum = this.varCount++;
    this.body.push(mod.local.set(varNum, generateExpr()));
    return new Expression(() => this.mod.local.get(varNum, B.f64));
  }
}

const multiopName: Record<string, "add" | "mul"> = {
  "+": "add",
  "*": "mul",
};

const binopName: Record<string,"sub" | "div"> = {
  "-": "sub",
  "/": "div",
};
