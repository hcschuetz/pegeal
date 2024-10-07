import { BackEnd, BEVariable, Scalar } from "./Algebra";
import scalarOp from "./scalarOp";


class NumericVar implements BEVariable<never> {
  #total = 0;

  add(val: Scalar<never>): void {
    this.#total += val;
  }

  value(): Scalar<never> {
    return this.#total;
  }
}

/**
A back end for purely numeric input.

(It is essentially unused if optimizations in `Algebra` already pre-calculate
purely numeric expressions.)
*/
export default class NumericBackEnd implements BackEnd<never> {

  makeVar(nameHint: string): BEVariable<never> {
    return new NumericVar();
  }

  scalarOp(name: string, ...args: number[]): Scalar<never> {
    return scalarOp(name, ...args);
  }
}
