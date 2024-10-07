import B from "binaryen";
import { Scalar, BackEnd, BEVariable } from "./Algebra";

export class LocalRef {
  constructor(readonly locNum: number) {}
}

class WASMVar implements BEVariable<LocalRef> {
  constructor(
    readonly be: WASMBackEnd,
  ) {}

  #localRef?: LocalRef;

  add(val: Scalar<LocalRef>) {
    const {mod, body, convertFactor} = this.be;
    const expr = convertFactor(val);
    if (!this.#localRef) {
      this.#localRef = this.be.newLocal();
      body.push(mod.local.set(this.#localRef.locNum, expr));
    } else {
      body.push(mod.local.set(this.#localRef!.locNum,
        mod.f64.add(mod.local.get(this.#localRef!.locNum, B.f64), expr)
      ));
    }
  }

  value() { return this.#localRef! };
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

  makeVar() {
    return new WASMVar(this);
  }

  newLocal() {
    return new LocalRef(this.varCount++);
  }

  /**
   * `convertFactor` is a bound function so that it can be used as
   * `[...].map(this.convertFactor)`
   */
  convertFactor = (f: Scalar<LocalRef>): B.ExpressionRef => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return this.mod.local.get(f.locNum, B.f64);
    }
  }

  scalarOp(name: string, ...args: Scalar<LocalRef>[]) {
    const {mod, convertFactor} = this;
    const localVar = this.newLocal();
    this.body.push(
      mod.local.set(localVar.locNum,
        name === "unaryMinus" ? mod.f64.neg(convertFactor(args[0])) :
        Object.hasOwn(binopName, name)
        ? mod.f64[binopName[name]](convertFactor(args[0]), convertFactor(args[1]))
        : mod.call(name, args.map(convertFactor), B.f64)
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
