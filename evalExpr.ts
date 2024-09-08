import { Context, Var, Term, AbstractVar } from "./Algebra";

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
    switch (name) {
      case "+": return args[0] + args[1];
      case "-": return args[0] - args[1];
      case "*": return args[0] * args[1];
      case "/": return args[0] / args[1];
      case "inversesqrt": return 1 / Math.sqrt(args[0]);
      // TODO support more WebGL2 functions here
      // TODO apply nArgs(...)?
      default: return (Math as any)[name](...args);
    }
  }

  space(): void {}
}
