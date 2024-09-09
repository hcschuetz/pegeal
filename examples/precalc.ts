import WebGLBackEnd from "../src/WebGLBackEnd";
import { p } from "./utils";

p(`// precalculate - WebGL\n`);

  const be = new WebGLBackEnd();

  const three = be.scalarOp("abs", be.scalarOp("-", 7, 10));
  be.emit(`// should be 3 (evaluated): ${three}`);

  p(be.text);