import B from "binaryen";
import { Scalar, BackEnd } from "./Algebra";

export class LocalRef {
  constructor(readonly locNum: number) {}
}

export default class WASMBackEnd implements BackEnd<LocalRef> {
  varCount = 0;
  body: B.ExpressionRef[] = [];
  paramsByHint: Record<string, LocalRef> = {};

  constructor(
    readonly mod: B.Module,
    readonly paramHints: string[],
  ) {
    for (const hint of paramHints) {
      this.paramsByHint[hint] = this.newLocal();
    }
  }

  get paramCount() { return this.paramHints.length; }

  newLocal() {
    return new LocalRef(this.varCount++);
  }

  /**
   * `convertScalar` is a bound function so that it can be used as
   * `[...].map(this.convertScalar)`
   */
  convertScalar = (f: Scalar<LocalRef>): B.ExpressionRef => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return this.mod.local.get(f.locNum, B.f64);
    }
  }

  scalarOp(name: string, ...args: Scalar<LocalRef>[]) {
    const {mod, convertScalar} = this;
    const localVar = this.newLocal();
    this.body.push(
      mod.local.set(localVar.locNum,
        name === "unaryMinus" ? mod.f64.neg(convertScalar(args[0])) :
        Object.hasOwn(binopName, name)
        ? mod.f64[binopName[name]](convertScalar(args[0]), convertScalar(args[1]))
        : mod.call(name, args.map(convertScalar), B.f64)
      )
    );
    return localVar;
  }
}

const binopName: Record<string, "add" | "sub" | "mul" | "div"> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
};
