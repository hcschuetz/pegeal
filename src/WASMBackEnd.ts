import B from "binaryen";
import { Term, Scalar, BackEnd, Var, truth } from "./Algebra";

export class VarRef implements VarRef {
  constructor(readonly varNum: number) {}
}

class VarImpl extends Var<VarRef> {
  constructor(
    readonly be: WASMBackEnd,
  ) {
    super();
  }

  #varRef?: VarRef;

  addTerm(term: Term<VarRef>, negate: truth, create: boolean) {
    const {mod, body, convertFactor} = this.be;
    const expr =
      term.length === 0 ? mod.f64.const(1) :
      term.map(convertFactor).reduce((acc, factor) => mod.f64.mul(acc, factor));
    const signedExpr = negate ? mod.f64.neg(expr) : expr;
    if (create) {
      this.#varRef = this.be.newLocal();
      body.push(mod.local.set(this.#varRef.varNum, signedExpr));
    } else {
      body.push(mod.local.set(this.#varRef!.varNum,
        mod.f64.add(mod.local.get(this.#varRef!.varNum, B.f64), signedExpr)
      ));
    }
  }

  getValue() { return this.#varRef! };
}

export default class WASMBackEnd extends BackEnd<VarRef> {
  varCount = 0;
  body: B.ExpressionRef[] = [];
  paramsByHint: Record<string, VarRef> = {};

  constructor(
    readonly mod: B.Module,
    readonly paramHints: string[],
  ) {
    super();
    for (const hint of paramHints) {
      this.paramsByHint[hint] = this.newLocal();
    }
  }

  get paramCount() { return this.paramHints.length; }

  makeVar() {
    return new VarImpl(this);
  }

  newLocal() {
    return new VarRef(this.varCount++);
  }

  /**
   * `convertFactor` is a bound function so that it can be used as
   * `[...].map(this.convertFactor)`
   */
  convertFactor = (f: Scalar<VarRef>) => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return this.mod.local.get(f.varNum, B.f64);
    }
  }
  
  scalarOp(name: string, ...args: Scalar<VarRef>[]) {
    const {mod, convertFactor} = this;
    const localVar = this.newLocal();
    this.body.push(
      mod.local.set(localVar.varNum,
        Object.hasOwn(binopName, name)
        ? mod.f64[binopName[name]](convertFactor(args[0]),convertFactor(args[1]))
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
