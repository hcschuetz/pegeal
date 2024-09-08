import binaryen from "binaryen";
import { Term, Factor, Context, AbstractVar } from "./Algebra";

interface VarRef {
  readonly varNum: number;
}

export class ParamRef implements VarRef {
  constructor(
    readonly ctx: WASMContext,
    readonly paramNum: number,
  ) {
    if (ctx.varNumUsed) {
      throw new Error("Cannot create ParamRef after using varNum");
    }
  }

  get varNum() { return this.paramNum; }

  toString() { return `p${this.varNum}`; }
}

export class LocalRef implements VarRef {
  constructor(
    readonly ctx: WASMContext,
    readonly localVarNum: number,
  ) {}

  get varNum(): number {
    this.ctx.varNumUsed = true;
    return this.ctx.paramHints.length + this.localVarNum;
  }

  toString() { return `v${this.varNum}`; }
}

class VarImpl extends AbstractVar<VarRef> {
  #created = false;
  #varRef?: VarRef;
  #numericPart = 0;

  constructor(
    readonly ctx: WASMContext,
  ) {
    super();
  }

  addImpl(term: Term<VarRef>, negate = false) {
    const {mod, body, formatFactor} = this.ctx;
    if (term.some(f => f === 0)) return;

    // We could easily eliminate 1 factors:
    //   term = term.filter(f => f !== 1);
    // but keeping them might make the generated code more readable,
    // and it should be easy for that code's compiler to optimize 1s away.

    if (term.every(f => typeof f === "number")) {
      this.#numericPart += term.reduce((x, y) => x * y, negate ? -1 : 1);
      return;
    }

    const expr =
      term.length === 0 ? mod.f64.const(1) :
      term.map(formatFactor).reduce((acc, factor) => mod.f64.mul(acc, factor));
    const signedExpr = negate ? mod.f64.neg(expr) : expr;
    if (!this.#created) {
      this.#varRef = this.ctx.newLocal();
      body.push(mod.local.set(this.#varRef.varNum, signedExpr));
    } else {
      body.push(mod.local.set(this.#varRef!.varNum,
        mod.f64.add(mod.local.get(this.#varRef!.varNum, binaryen.f64), signedExpr)
      ));
    }
    this.#created = true;
  }

  onFreeze(): void {
    const {mod, body} = this.ctx;
    if (this.#created && this.#numericPart !== 0) {
      body.push(mod.local.set(this.#varRef!.varNum,
        mod.f64.add(
          mod.local.get(this.#varRef!.varNum, binaryen.f64),
          mod.f64.const(this.#numericPart)
        )
      ));
    }
  }

  valueImpl() {
    return this.#created ? this.#varRef! : this.#numericPart;
  }
}

export class WASMContext implements Context<VarRef> {
  localVars: binaryen.Type[] = [];
  body: binaryen.ExpressionRef[] = [];
  varNumUsed = false;

  constructor(
    readonly mod: binaryen.Module,
  ) {}

  paramHints: string[] = [];
  param(hint: string): ParamRef {
    const {paramHints} = this;
    const i = paramHints.length;
    paramHints.push(hint);
    return new ParamRef(this, i);
  }

  makeVar() {
    return new VarImpl(this);
  }

  newLocal() {
    const localVarNum = this.localVars.length;
    this.localVars.push(binaryen.f64);
    return new LocalRef(this, localVarNum);
  }

  /** formatFactor is a bound function, so it can be used as `[...].map(formatFactor)` */
  formatFactor = (f: Factor<VarRef>) => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return this.mod.local.get(f.varNum, binaryen.f64);
    }
  }
  
  scalarOp(name: string, ...args: Factor<VarRef>[]) {
    const {mod, formatFactor} = this;
    const localVar = this.newLocal();
    this.body.push(
      mod.local.set(localVar.varNum,
        Object.hasOwn(binopName, name)
        ? mod.f64[binopName[name]](formatFactor(args[0]),formatFactor(args[1]))
        : mod.call(name, args.map(formatFactor), binaryen.f64)
      )
    );
    return localVar;
  }

  space(): void {}
}

const binopName: Record<string, "add" | "sub" | "mul" | "div"> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
};
