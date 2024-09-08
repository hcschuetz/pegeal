import { Context, Var, Term, AbstractVar } from "./Algebra";
import scalarOp from "./scalarOp";

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

  scalarOp(name: string, ...args: number[]): number {
    return scalarOp(name, ...args);
  }

  space(): void {}
}
