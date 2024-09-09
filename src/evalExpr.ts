import { Context, Term, truth, Var } from "./Algebra";

/*
This module used to work on purely numeric input and to evaluate it
immediately.

Meanwhile the Algebra pre-calculates purely numeric expressions.
So the respective methods in this module will no more be called.
*/

class VarImpl extends Var<never> {
  addTerm(term: Term<never>, negate: truth, create: boolean): void {
    throw new Error("This method should never be called");
  }

  getValue(): never {
    throw new Error("This method should never be called");
  }
}

export class EvalContext extends Context<never> {

  makeVar(nameHint: string): Var<never> {
    return new VarImpl();
  }

  scalarOp(name: string, ...args: number[]): number {
    throw new Error("This method should never be called");
  }
}
