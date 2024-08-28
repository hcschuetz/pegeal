import { Context, Var, Term, BinOp, AbstractVar } from "./Algebra";

class VarImpl extends AbstractVar<never> {
  #value = 0;

  addImpl(term: Term<never>, negate = false): void {
    this.#value += term.reduce((x, y) => x * y, negate ? -1 : 1);
  }

  valueImpl(): number {
    return this.#value;
  }
}

export class EvalContext implements Context<never> {

  makeVar(nameHint: string): Var<never> {
    return new VarImpl();
  }

  scalarFunc(name: string, ...args: number[]): number {
    return (Math as any)[name](...args);
  }

  binop(name: BinOp, f1: number, f2: number): number {
    switch (name) {
      case "+": return f1 + f2;
      case "-": return f1 - f2;
      case "*": return f1 * f2;
      case "/": return f1 / f2;
    }
  }

  space(): void {}
}
