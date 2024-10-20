import { BackEnd, Scalar } from "./Algebra";
import scalarOp from "./scalarOp";


/**
A back end for purely numeric input.

(It is essentially unused if optimizations in `Algebra` already pre-calculate
purely numeric expressions.)
*/
export default class NumericBackEnd implements BackEnd<never> {
  scalarOp(name: string, args: number[], options?: {}): Scalar<never> {
    return scalarOp(name, args);
  }
}
