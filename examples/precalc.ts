import { WebGLContext } from "../src/generateWebGL";
import { p } from "./utils";

p(`// precalculate - WebGL\n`);

  const ctx = new WebGLContext();

  const three = ctx.scalarOp("abs", ctx.scalarOp("-", 7, 10));
  ctx.emit(`// should be 3 (evaluated): ${three}`);

  p(ctx.text);