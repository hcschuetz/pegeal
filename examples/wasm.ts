import fs from "node:fs";
import zlib from "node:zlib";

import B from "binaryen";

import WASMBackEnd from "../src/WASMBackEnd";
import { Algebra } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import { p } from "./utils";

console.log(`// WASM generation\n`);

B.setFastMath(true);

const mod = new B.Module();
mod.setFeatures(B.Features.Multivalue);

const be = new WASMBackEnd(mod,
  "m_z g_x g_y g_z h_x h_y h_z e_x e_w" // d_z
  .split(" ")
);
const param = be.paramsByHint;
const coords = "xyzw";
const alg = new Algebra([1,333,param.m_z,-1], be, makeLetterNames(coords));

const g = alg.mv("g", {x: param.g_x, y: param.g_y, z: param.g_z});
const h = alg.mv("h", {x: param.h_x, y: param.h_y, z: param.h_z});
const gh = alg.geometricProduct(g, h);
const inputs = [
  // alg.mv("d", {x: 2.22, z: param.d_z, w: 4.44}),
  alg.mv("e", {x: param.e_x, w: param.e_w}),
];

const sandwich_gh = alg.sandwich(gh);
const invNorm = be.scalarOp("/", 1, sandwich_gh(alg.one()).value(0));
const results = inputs.map(inp => alg.scale(invNorm, sandwich_gh(inp)));
// TODO make use of the bitmaps in result
be.body.push(
  mod.return(mod.tuple.make(
    results.flatMap(res => [...res].map(([,val]) => be.convertFactor(val)))
  ))
);

const f64Array = (length: number): B.Type[] => new Array(length).fill(B.f64);

const fn = mod.addFunction(
  "myTest",
  B.createType(f64Array(be.paramCount)),
  B.createType(f64Array(results.flatMap(res => [...res]).length)),
  f64Array(be.varCount - be.paramCount),
  mod.block(null, be.body),
);
mod.addFunctionExport("myTest", "myTestExt");
p(`// valid: ${Boolean(mod.validate())}`);

// TODO instead of .optimize(), add the needed passes to .runPasses([...])
// (Some passes of .optimize() are apparently undone by my subsequent
// passes.  So we should not run them in the first place.)
mod.optimize();
// Make the output more readable:
mod.runPasses([
  // See https://github.com/WebAssembly/binaryen/blob/main/src/passes/pass.cpp
  // for available passes.
  "flatten",
  "simplify-locals-notee",
  "ssa",
  // simplifying again produces nicer code (in some cases):
  "simplify-locals-notee",
  // I hoped that (with fastMath === true) this converts `a * c + b * c` to
  // `(a + b) * c`, but it doesn't:
  "optimize-instructions",
  "vacuum", // removes `(nop)`s
  "coalesce-locals", // removes (most) unused variables
  "ssa", // for readability only, omit for production
]);

writeAndStat("out.wst", mod.emitText());
const binary = mod.emitBinary();
writeAndStat("out.wasm", binary);

{
  const {name, params, body} = B.getFunctionInfo(fn);
  const paramTypes = B.expandType(params)
  const header = `// Code in some fantasy language:\nfunction ${name}(${
    be.paramHints.map((hint, i) => `\n  float v${i} /* ${hint} */`).join(",")
  }\n  // ${
    paramTypes.length
  }${
    paramTypes.length === be.paramCount ? "" :
    " [### param number mismatch ###]"
  }\n) : [${
    results.flatMap((res, i) => [...res].map(([bm]) => `\n  float /* out[${i}].${alg.bitmapToString[bm]} */`).join(","))
  }\n]`;
  const prettyLines: string[] = [header];
  prettyStmt(body, line => prettyLines.push(line));
  const pretty = prettyLines.join("\n");
  writeAndStat("out.mylang", pretty);
  p();
  p(pretty);
}

function writeAndStat(where: string, what: string | Uint8Array) {
  fs.mkdirSync("./output", { recursive: true });
  fs.writeFileSync("./output/" + where, what);
  p(`// ${where}: ${what.length} (brotli ${zlib.brotliCompressSync(what).length})`);
}

function prettyStmt(stmt: B.ExpressionRef, emit: (line: string) => unknown): void {
  const stmtInfo = B.getExpressionInfo(stmt);
  switch (stmtInfo.id) {
    case B.NopId: {
      break;
    }
    case B.LocalSetId: {
      const {isTee, index, value} = stmtInfo as B.LocalSetInfo;
      if (isTee) emit("### tee not supported");
      // This assumes single-assignment form:
      indent(`float v${index} = ${prettyExpr(value)};`, emit)
      break;
    }
    case B.ReturnId:
      const {value} = stmtInfo as B.ReturnInfo;
      indent(`return ${prettyExpr(value)};`, emit);
      break;
    case B.BlockId: {
      const {children} = stmtInfo as B.BlockInfo;
      emit("{");
      for (const child of children) {
        prettyStmt(child, line => emit("  " + line));
      }
      emit("}");
      break;
    }
    case B.UnreachableId: {
      emit("// unreachable");
      break;
    }
    default: {
      emit("### statement " + stmtInfo.id);
      break;
    }
  }
}

function indent(text: string, emit: (line: string) => unknown): void {
  text.split("\n").forEach(emit);
}

function prettyExpr(expr: B.ExpressionRef): string {
  const exprInfo = B.getExpressionInfo(expr);
  switch(exprInfo.id) {
    case B.ConstId: {
      const {value} = exprInfo as B.ConstInfo;
      return `${value}`;
    }
    case B.LocalGetId: {
      const {index} = exprInfo as B.LocalGetInfo;
      return `v${index}`;
    }
    case B.UnaryId: {
      const {op, value} = exprInfo as B.UnaryInfo;
      switch (op) {
        case B.NegFloat64: return `(-${prettyExpr(value)})`;
        default: return "### unary " + op;
      }
    }
    case B.BinaryId: {
      const {op, left, right} = exprInfo as B.BinaryInfo;
      const opString =
        op === B.AddFloat64 ? "+" :
        op === B.SubFloat64 ? "-" :
        op === B.MulFloat64 ? "*" :
        op === B.DivFloat64 ? "/" :
        "### binop " + op;
      return `(${prettyExpr(left)} ${opString} ${prettyExpr(right)})`;
    }
    case B.TupleMakeId: {
      const {operands} = exprInfo as B.TupleMakeInfo;
      // TODO properly indent line breaks within elem output
      return `[\n   ${operands.map(elem => prettyExpr(elem)).join(",\n   ")}\n]`;
    }

    default: return "### expr " + exprInfo.id;
  }
}
