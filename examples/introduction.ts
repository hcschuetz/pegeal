////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                           INTRODUCTORY EXAMPLES                            //
//                                                                            //
// Run this code, play with it, and see what impact your changes have on the  //
// results and generated code.                                                //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

// For experimentation it is most convenient to run this code with a system
// that accepts TypeScript code directly (without the need for emitting
// JavaScript files). Use, for example, one of these calls:
//
//     node --import=tsx examples/introduction.ts
//     deno run --unstable-sloppy-imports examples/introduction.ts
//     bun examples/introduction.ts
//
// This code has been tested with TypeScript 5.4.5, node v20.16.0, deno 1.44.1,
// and bun 1.1.26, but should work with any reasonably new version.
//
// It also helps to use an editor supporting TypeScript.

import { Algebra, Multivector } from "../src/Algebra";
import { makeLetterNames } from "../src/componentNaming";
import WebGLBackEnd from "../src/WebGLBackEnd";

// Use basis-blade names such as "1", "y", "zw", "xyz", and "xyzw".
const basisBladeNames = makeLetterNames("xyzw");
// (There is also a helper function creating names such as "1", "e2" and "e013".)

// We use a Euclidean metric for x, y, and z.  For w we use a symbolic value
// (that is, a variable name), which must be provided at run time.  (Just to
// demonstrate that numbers and symbolic values can be mixed.)
const metric = [1, 1, 1, "metric_w"];

// Create (fragments of) WebGL code:
const be = new WebGLBackEnd();

// Now we have everything needed to set up an algebra:
const alg = new Algebra(metric, be, basisBladeNames);


// In example code we typically emit results as comments to the back-end
// so that they will appear interspersed with the generated code.
// Here is a helper function for that:
function output(label: string, value: any) {
  be.comment(`${label} ===> ${value}`);
  be.comment("-".repeat(77));
}

// Now finally for some Geometric-Algebra code.
try {

  // This should be self-explanatory:
  const [ex, ey, ez, ew] = alg.basisVectors();

  // We can construct a multivector from basis vectors.
  // (Here it is just a plain 1-vector.)
  const a = alg.plus(
    alg.scale(3, ex),
    alg.scale(4, ey),
    alg.scale(2, ez),
  );
  output("a", a);

  // It is more convenient to construct (multi)vectors from objects.
  // Here we use a symbolic value for the w component.
  const b = alg.mv({x: -2, y: 1, w: "my_symbolic_b_w"}, {named: "b"});
  output("b", b);
  // There is also a shortcut for 1-vectors.
  const c = alg.vec([-2, 0, 1, "my_symbolic_b_w"], {named: "c"});
  output("c", c);

  // Up to this place no code was generated since everything could be computed
  // immediately.  This is because we did not need any symbolic value yet.
  // (Even the symbolic metric factor was not used as `a` has no `w` component.)
  // However, several comments were emitted giving us an idea which multivectors
  // have been created.

  // The first computation generating some non-trivial code:
  output("|b|", alg.norm(b));

  // Now let us compute some products:
  const ab = alg.geometricProduct(a, b);
  output("a b      ", ab);
  output("a ∧ b    ", alg.wedgeProduct(a, b));
  // Notice that the code generated for the two products above is essentially
  // the same.  This is because no code needed to be generated for the scalar
  // component of the geometric product (and the two products differ only in
  // the scalar component here).

  // The scalar product of a and b is not very interesting since it can be
  // computed immediately and no code needs to be generated:
  output("a * b    ", alg.scalarProductMV(a, b));
  // (The same holds for the other supported inner products.)

  // The scalar product above returned a multivector that happened to be a scalar.
  // There is also a version of the scalar product returning the Scalar type:
  output("a * b    ", alg.scalarProduct(a, b));

  // In these contraction products we use the geometric product `ab` defined
  // above:
  output("a ⌋ (a b)", alg.contractLeft(a, ab));
  output("(a b) ⌊ b", alg.contractRight(ab, b));


  // An example using more advanced algebra features:
  function rotationExample(
    label: string,
    pattern: Parameters<typeof alg.sandwich>[1],
    a: Multivector<string>,
    b: Multivector<string>,
  ) {
    be.comment("");
    be.comment("=".repeat(77));
    be.comment(`rotation example (${label}):`);
    be.comment("");

    a = alg.normalize(a);
    b = alg.normalize(b);

    output("a", a);
    output("b", b);
    output("∡(a, b)", alg.getAngle(a, b));

    const doubleRotor = alg.geometricProduct(b, a);
    output("doubleRotor", doubleRotor);

    const doubleBlade = alg.log(doubleRotor);
    output("doubleBlade", doubleBlade);

    const oneTenthBlade = alg.scale(1/20, doubleBlade);
    output("oneTenthBlade", oneTenthBlade);

    const oneTenthRotor = alg.exp(oneTenthBlade);
    output("oneTenthRotor", oneTenthRotor);

    // `sandwich(p, pattern)(q)` is an optimized version of `p q ~p`:
    // (The `pattern` parameter tells the `sandwich` method which
    // basis blades to expect in `q`.)
    const rotate = alg.sandwich(oneTenthRotor, pattern);
    const aRotated = rotate(a);
    output("rotate(a)", aRotated);
    // For comparison:
    const slerp = alg.slerp(a, b);
    output("slerp-based", slerp(0.1));

    // With purely numeric input, the angle between a and aRotated should be
    // one tenth of the angle between a and b computed above:
    output("∡(a, rotate(a))", alg.getAngle(a, aRotated));

    // We can re-use `rotate` and `slerp`:
    const bRotated = rotate(b);
    output("rotate(b)", bRotated);
    output("slerp-based", slerp(1.1));
    output("∡(b, rotate(b))", alg.getAngle(b, bRotated));
  }

  // Run the rotation example with all numbers given:
  // (We are not using the w coordinate here since that has a symbolic metric.)
  // This evaluates the expression fully and does not generate any code.
  rotationExample(
    "numeric",
    ["x", "y", "z"],
    alg.vec([ 1, -2, 0, 0]),
    alg.vec([.5, .7, 1, 0]),
  );

  // Running the example with simple symbolic input generates code
  // that is relatively easy to understand:
  rotationExample(
    "symbolic",
    ["x", "y", "z"], // Notice that "z" is not being used.
    alg.vec(["a_x", "a_y", 0, 0]),
    alg.vec(["b_x", "b_y", 0, 0]),
  );

  // Using our vectors from above produces more complex output:
  // rotationExample("partially symbolic", ["x", "y", "z", "w"], a, b);
} finally {
  console.log(be.text);
}
