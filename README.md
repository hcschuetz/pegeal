PEGEAL:<br>Partial Evaluation for Geometric Algebra
===================================================

This package translates geometric-algebra expressions to lower-level code.

Currently WebGL and WebAssembly (WASM) can be generated, but implementing
backends for other languages is very little effort.

> ## WARNING
>
> This is not a ready-made library but still experimental code.
>
> Before using it for productive purposes you should
> - understand the code generator or the generated code,
> - be able to integrate the generated code with the rest of your application,
> - not depend on this package being maintained in any way,
> - agree to the conditions of the MIT license.
>
> (As of mid September 2024 I have not even got around to
> actually execute any of the generated code.
> But that's on my TODO list.)
> 
> **Also this README still needs some work.**
>
> OTOH, the core partial-evaluation code has reached some maturity.

Since the package is implemented in TypeScript,
it is not only possible to create code in a build step or in a server.
Code (for example, WebGL or WebAssembly) can also be generated on demand
in a web browser.


## TL;DR

```
git clone https://github.com/hcschuetz/pegeal.git
cd pegeal
npm install
```
Have a look at [`examples/introduction.ts`](examples/introduction.ts).
```bash
node --import=tsx examples/introduction.ts # or use deno or bun
```
Have a look at the output.

Then play with the introduction example and also run other examples.
The multi-backend example
([`examples/multi-backend.ts`](examples/multi-backend.ts)) might be particularly
interesting.

## Algebras

Multivectors do not exist in empty space.  Instead each multivector belongs to
an algebra.

Operations on multivectors are implemented as methods of the algebra,
taking the multivectors as parameters.
Most operations of an algebra taking multivector parameters require that these
belong to that same algebra.
This avoids accidental cross-algebra operations,
which usually have no well-defined meaning.

An algebra has a metric
and uses it in products and other operations on multivectors.
This way it is not necessary to explicitly pass the metric as a parameter
to each operation.
We only support Euclidean and pseudo-Euclidean metrics, that is,
we assume that the basis vectors of the algebra are pairwise orthogonal.

If needed, an outermorphism can be used to convert a multivector
from one algebra to another.
This can be used to implement an algebra with a more general metric
(such as a conformal geometric algebra)
on top of another algebra with a (pseudo-)Euclidean metric,
but for now such an implementation is not provided.

Furthermore the algebra knows coordinate names for all basis blades.
This is used to parse and to print multivectors.
(The multivectors themselves just identify the basis blades by numeric indices.)

The caller has to pass these parameters to the `Algebra` constructor:

- Metric factors for the basis vectors.
  The length of this list also determines the dimensionality `n` of the algebra.

  A (trivial) helper function `euclidean` can be used to make it explicit
  in the code that a Euclidean metric is being used.

- A back-end that knows how to generate code for a particular target language.

  Currently there are back-ends for WebGL and WebAssembly/WASM.
  There is also a "dummy" back-end that does not generate any code,
  but can be used to 

  Additional back-ends are quite easy to implement.

- A list of basis-blade names.
  This list should have length `2**n` and should not contain duplicates.

  Some utility functions (`makeLetterNames` and `makeNumberedNames`)
  are available to produce typical component names,
  but the application programmer is free to choose another naming scheme.

## Multivectors

### Logical Structure

A basis blade is a set of basis vectors.
Essentially a multivector is a partial map from basis blades to magnitudes.
The latter are either numbers or symbolic values.

Thus a component of a multivector for some basis blade
can be in one of these states:
- It can be missing, which is interpreted as magnitude 0.
- It can be a number providing the magnitude at code-generation time.
- It can be a symbolic value,
  that is, a reference to the target-language variable
  which will hold the magnitude at run time.

### Minimizing Run-Time Data and Computations

The algebra operations attempt to avoid symbolic values
and their computation by generated run-time code whenever possible.

But note that this optimization is only performed per-operation
and not globally.
So the algebra will not recognize that certain complex expressions such as
`M + (-M)` or `a^b + b^a` (with 1-vectors a and b) are actually 0.

In such cases the application programmer should either re-formulate
the algebraic expressions or explicitly drop some components using the method
`extract` or `extractGrade`. 
It is also possible to provide a 

### Data Structure

Technically we represent a basis blade as a bitmap,
that is, a non-negative integer.
The component map is implemented as a sparse JavaScript array where
the indices are the bitmaps and
the values are the magnitudes (numbers or symbolic).

### Multivector Creation and Initialization

The `Multivector` constructor takes
- the algebra to which the multivector will belong,
- a name (essentially for debugging purposes),
- and an initialization function.

That initialization function will be invoked immediately
from within the multivector constructor.
It receives a callback function usually named `add`.
(Since the initialization function is already a callback,
the `add` function could be called a "second-order" callback.)
The `add` function is used to populate the multivector.
It takes three parameters:
- a basis blade represented as a bitmap (telling to which component
  this addition contributes),
- a term (a list of numbers and symbolic values whose members will be
  multiplied and then added to the component),
- and a negation flag (telling whether the term's sign should be inverted,
  or, in other words, whether the term should be subtracted rather than added).

To repeat: `add` is *not* a setter function for multivector components.
You can call it multiple times with the same basis blade
and the provided terms will be added up (or subtracted).

This API is quite convenient for creating new multivectors in the algebra code:
- It protects the multivector from being modified inadvertently
  after construction.
- There is no need to group the terms by basis blade.
  This is done automatically behind the scenes.
- It allows for fluent programming.  Instead of the usual pattern
  ```js
  const result = new Multivector(...);
  for various cases {
    result.add(...);
  }
  return result;
  ```
  one simply writes
  ```js
  return new Multivector(..., add => {
    for various cases {
      add(...);
    }
  });
  ```
  without the need for an auxiliary variable `result`.

### Unitness Flag
...
- avoids normalization, inversion, and computation of norms.
- keeps track if a multivector is known to be a unit vector at code-generation
  time.
- set automatically in some operations, e.g.:
  - after normalization
- can also be set by the user (that is, the application programmer)
  - e.g. slerp, if we did not have it in the algebra
- .markAsUnit(...) for fluent programming

...similar idea: versorness flag
- log a warning (or throw?) if a method expecting a versor gets called with
  a (possibly) non-versor

## Back-Ends

... for lower-level code generation.

... multiple implementations

Various types have a type parameter `T`, which is the type that the
back-end uses to represent "symbolic values", that is, scalar variables
in the target language.

For example:
- `Scalar<T>`: A scalar value, either a number known at code-generation time
  or a symbolic value.
- `Var<T>` and its implementations: A scalar variable in the "source language",
  possibly backed by a scalar variable of type `T` in the "target language".
- `Multivector<T>`: A multivector whose component magnitudes are stored as
  `Var<T>`s.

### Variables

Each back-end has its subclass of `Var<T>`.
An instance of `Var<T>` represents a source-level scalar variable,
which can be a component magnitude in a multivector
or an intermediate or final result of some scalar computation.

The abstract class `Var<T>` provides API methods `add` and `value`.
- It starts with value 0 upon creation.
- Then (numeric and/or symbolic) values can be added to the variable.
- Finally the value can be retrieved.
  It is a number or a symbolic value of type `T`,
  that is, a reference to a target-language variable.

As soon as the value has been retrieved, the variable is "frozen", that is,
no more values may be added.  This is to detect bugs where a variable's value
is retrieved before it is completely computed.

The `add` method avoids creating the corresponding target-language
variable as long as possible, that is, as long as all the added terms are
fully numeric and do not contain symbolic values.

`Var<T>` requires its subclasses to provide similar API methods
(`addValue` and `getValue`).
These are only called if and when a symbolic value is actually needed.

### Back-End Imlementations

#### Dummy Back-End

In earlier versions
this back-end expected fully numeric input and no symbolic values.
Accordingly, the type parameter here is `<never>`,
indicating that we  _never_ deal with variables.
All computations were performed immediately and a numeric result was returned,
_never_ a symbolic value.

Meanwhile the `Algebra` operations pre-calculate purely numeric expressions
as far as possible to optimize code generated by any back-end.
As a consequence, most methods of this back-end and its variable implementation
are no more invoked.
The methods now simply throw exceptions to verify this assumption.

#### Emitting WebGL

The `WebGLBackend` is quite straight-forward.
- It represents symbolic values as strings, which are the WebGL variable names.
- A counter is used to create unique variable-name suffixes.
- The generated code is written to a string.

#### Emitting WebAssembly ("WASM")

The `WebAssemblyBackEnd` uses the `binaryen` API for code generation.
- Symbolic values are of class `LocalRef`, which is just a wrapper around
  the index of the local variable in the WASM function.
  (The index cannot be used directly as it would be interpreted as the
  actual value.)
- A counter keeps track of used local-variable indices.
- A list of `ExpressionRef`s is used to collect the created "WASM statements".

A usage example even demonstrates how `binaryen` can be used
as an intermediate representation and optimizer,
which can be translated to yet another language.

## Implementation Details

### Products

All kinds of products are ultimately impemented by the single method `product2`.

The method considers each partial product of
some component `(A, α)` from the left operand and
some component `(B, β)` from the right operand
for inclusion in the result.
(Here `A` and `B` are basis blades and
`α` and `β` are the corresponding magnitudes.)

The product of `α` and `β` (and metric factors and a sign, see below)
will be used as a term of the result component for basis blade
`Out := (A \ B) ∪ (B \ A)`
under the following conditions depending on the product kind:

| product kind      | set-based condition | grade-based condition
|-------------------|:-------------------:|----------------------
| geometric         | `true`              | `true`
| wedge (= outer)   | `A ⋂ B = {}`        | `\|Out\| = \|A\| + \|B\|`
| left contraction  | `A ⊂ B`             | `\|Out\| = \|B\| - \|A\|`
| right contraction | `A ⊃ B`             | `\|Out\| = \|A\| - \|B\|`
| scalar            | `A = B`             | `\|Out\| = 0`
| dot               | `A ⊂ B` or `A ⊃ B`  | `\|Out\| = abs(\|A\| - \|B\|)`
|

Here `|S|` denotes the cardinality of a set `S`
and thus the grade of a basis blade.
To avoid confusion, we used the different notation `abs(...)`
for the absolute value of a number in the "dot" line above.

To emphasize their analogy, the "scalar" and "dot" cases could be defined
equivalently as:

| product kind | set-based condition | grade-based condition
|--------------|:-------------------:|:---------------------
| scalar       | `A ⊂ B` and `A ⊃ B` | `\|Out\| = \|B\| - \|A\|` and `\|Out\| = \|A\| - \|B\|`
| dot          | `A ⊂ B` or  `A ⊃ B` | `\|Out\| = \|B\| - \|A\|` or  `\|Out\| = \|A\| - \|B\|`
|

Notice that in all cases
the set-based conditions can be formulated using just the inputs
whereas the grade-based conditions also depend on the result basis blade `Out`.

I also consider the set conditions easier to understand.
They can also be implemented as bitmap operations easily.
The resulting basis blade `Out` is easily implemented
as an XOR between the bitmaps for `A` and `B`.

The metric factors of the basis vectors in `A ⋂ B` are included in the
partial-product term.
As an optimization, the term is skipped if any of these factors is 0.


### Flip Counting

The auxiliary function `productFlips(bitmapA, bitmapB)` computes the number
of adjacent transpositions needed to ensure that the resulting list of basis
blades is properly ordered.
The rest of this number modulo 2 (= the last bit of the binary representation)
tells if the partial product must be negated or not.

> The time complexity of `productFlips` is `𝒪(Amax)`,
where `Amax` is the highest basis-vector index in `A`,
even though it does not rely on a constant-time `popcnt` operation.
All implementations I have seen so far either depend on `popcnt` or
have a time complexity of at least `𝒪(|A| * |B|)`.
(But actually the performance does not matter much here
since this function is invoked at code-generation time, not at run time.)

There are also two unary helper functions
- `gradeInvolutionFlips(bitmap)` and
- `reverseFlips(bitmap)`.

The need for a sign flip in a grade involution can be determined by looking
at the last bit of the basis blade's grade,
that is, the population count of the bitmap.

The condition for the reverse operation is very similar:
Just look at the penultimate bit of the grade.

> It actually came as a bit of surprise to me that `(|A| * (|A|-1) / 2) % 2`
can be simplified to `(|A| >> 1) % 2`.


### Sandwich Products

...

## Open Issues

- A configuration method telling if a particular optimization step should be
  performed or not.

... The core task of generation is quite well-understood.
But it still needs to be figured out how to integrate this in a
complete application.

- Can be used to generate
  - CPU code (e.g., code setting up meshes)
  - GPU code
    - vertex shaders
    - fragment shaders

... but where does it make most sense?

... advantage: The same GA code can be converted to different targets.

- A parser for a language supporting terser notation of GA expressions than the
  API calls in TypeScript/JavaScript.

- Support conformal geometric algebras

- Interface to an existing "3D engine"?

## Unsorted

Topics to elaborate on:

- The generated code will typically be processed by another compilation step.
  It is expected that this compiler is able to perform various straight-forward
  optimizations so that the algebra methods and the back-end need not care about
  these lower-level details.

  Nevertheless the algebra does perform pre-calculations
  because they might lead to zero values,
  which can be used to do higher-level optimizations in turn.