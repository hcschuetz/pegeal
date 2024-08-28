import { Context, Var, Term, BinOp } from "./Algebra";

class VarImpl implements Var<never> {
  #value = 0;
  #frozen = false;

  add(term: Term<never>, negate = false): void {
    if (this.#frozen) throw new Error("trying to update frozen variable");

    this.#value += term.reduce((x, y) => x * y, negate ? -1 : 1);
  }

  value(): number {
    this.#frozen = true; // no more updates after the value has been read
    return this.#value;
  }
}

export class EvalContext implements Context<never> {

  space(): void {}

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
}
