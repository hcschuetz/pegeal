import { Context, ScalarFuncName, ScalarFunc2Name, Var, Term } from "./Algebra";

class VarImpl implements Var<never> {
  #value = 0;

  add(term: Term<never>): void {
    this.#value += term.reduce((x, y) => x * y, 1);
  }

  value(): number {
    return this.#value;
  }
}

export class EvalContext implements Context<never> {

  space(): void {}

  makeVar(nameHint: string): Var<never> {
    return new VarImpl();
  }

  scalarFunc(name: ScalarFuncName, f: number) {
    return Math[name](f);
  }

  scalarFunc2(name: ScalarFunc2Name, f1: number, f2: number): number {
    switch (name) {
      case "+": return f1 + f2;
      case "-": return f1 - f2;
      case "*": return f1 * f2;
      case "/": return f1 / f2;
      case "atan2": return Math.atan2(f1, f2);
    }
  }
}
