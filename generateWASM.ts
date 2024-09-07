import binaryen from "binaryen";
import { Term, Factor, Context, BinOp, AbstractVar } from "./Algebra";
import { EvalContext } from "./evalExpr";

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
  private evalCtx = new EvalContext();
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

  formatFactor = (f: Factor<VarRef>) => {
    switch (typeof f) {
      case "number": return this.mod.f64.const(f);
      case "object": return this.mod.local.get(f.varNum, binaryen.f64);
    }
  }
  
  scalarFunc(name: string, ...args: Factor<VarRef>[]) {
    const {mod} = this;
    // If the actual values of the args are known, evaluate the function call
    // at code-generation time.  Most of the time we could simply leave this
    // optimization to the WebGL compiler.  But occasionally it helps to
    // evaluate such calls here:
    // - Detect NaN and infinity in the generated code, not at runtime.
    // - Certain results (typially 0 or 1) may allow for further optimizations
    //   by the code generator.
    if (args.every(arg => typeof arg === "number")) {
      return this.evalCtx.scalarFunc(name, ...args);
    }

    const localVar = this.newLocal();
    this.body.push(
      mod.local.set(localVar.varNum,
        mod.call(name, args.map(this.formatFactor), binaryen.f64)
      )
    );
    return localVar;
  }

  binop(name: BinOp, f1: Factor<VarRef>, f2: Factor<VarRef>) {
    // See the comment at the beginning of scalarFunc(...).
    if (typeof f1 === "number" && typeof f2 === "number") {
      return this.evalCtx.binop(name, f1, f2);
    }

    const localVar = this.newLocal();
    this.body.push(
      this.mod.local.set(localVar.varNum, this.mod.f64[binopName[name]](
        this.formatFactor(f1),
        this.formatFactor(f2)
      ))
    );
    return localVar;
  }

  space(): void {}
}

const binopName: Record<BinOp, "add" | "sub" | "mul" | "div"> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
};
