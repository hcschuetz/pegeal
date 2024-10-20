
export default
function scalarOp(name: string, args: number[]): number {
    switch (name) {
      case "+": return args.reduce((acc, arg) => acc + arg);
      case "-": return args[0] - args[1];
      case "*": return args.reduce((acc, arg) => acc * arg);
      case "/": return args[0] / args[1];
      case "inversesqrt": return 1 / Math.sqrt(args[0]);
      case "unaryMinus": return -args[0];
      // TODO support more WebGL2 functions here
      // TODO apply nArgs(...)?
      default: return (Math as any)[name](...args);
    }
  }
