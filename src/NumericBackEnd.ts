import { BackEnd, Scalar, Var } from "./Algebra";
import scalarOp from "./scalarOp";


class VarImpl extends Var<never> {
  #total = 0;

  addValue(val: Scalar<never>, create: boolean): void {
    this.#total += val;
  }

  getValue(): Scalar<never> {
    return this.#total;
  }
}

/**
A back end for purely numeric input.

(It is essentially unused if optimizations in `Algebra` already pre-calculate
purely numeric expressions.)
*/
export default class NumericBackEnd extends BackEnd<never> {

  makeVar(nameHint: string): Var<never> {
    return new VarImpl();
  }

  scalarOp(name: string, ...args: number[]): Scalar<never> {
    return scalarOp(name, ...args);
  }
}
