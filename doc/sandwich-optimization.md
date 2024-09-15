Sandwich Optimization
---------------------

Consider the sandwich product `r := p q ~p` with vectors `p:= px ex + py ey`
and `q := qz ez` and a Euclidean metric.

 `r` can be computed as:
```js
r
= p q ~p
= (px ex + py ey) (qz ez) ~(px ex + py ey)
= (px ex + py ey) (qz ez) (px ex + py ey)
= px qz px ex ez ex + px qz py ex ez ey + py qz px ey ez ex + py qz py ey ez ey
= - px px qz ez - px py qz ex ey ez + px py qz ex ey ez - py py qz ez
                ------------------- -------------------
= - px px qz ez - py py qz ez
= (- px px qz - py py qz) ez
```
Notice that the underlined terms `- px py qz ex ey ez` and `+ px py qz ex ey ez`
cancelled each other out.

A straight-forward code generator handles `r := p q ~p = (p q) ~p `
by introducing an auxiliary variable `aux := p q`.
Then code for `r` is generated in a second step from
`r := aux ~p`, or just `r := aux p` as `p` is a 1-vector.
On the coordinate level this looks like this:
```js
// aux := p q
aux_xz = px * qz;
aux_yz = py * qz;

// r := aux p
r_z   = - aux_xz * px - aux_yz * py;
r_xyz = - aux_xz * py + aux_yz * px;
```

At run-time `r_xyz` will always evaluate to 0, but a code generator for
`r := aux p` does not know this without information how `aux` was defined.

This leads to two problems:
- The computation of `r_xyz` is wasted effort.
- Perhaps more importantly, subsequent computations involving `r` will produce
  more superfluous code based on the component `r_xyz`.

So we should avoid the computation of `r_xyz`.  How can we do this?

The code generator for `r := aux p` might look up the definitions of `aux_xz`
and `aux_yz`, inline them in the definition of `r_xyz`, simplify the expression
to 0, and therefore drop the component `r_xyz`.
But searching for optimization opportunities like this in general would be quite
an effort.

To detect such optimization opportunities more easily,
we make use of the fact that this problem typically arises in sandwich
products, which use a factor twice and which occur frequently
in geometric algebra.

In the high-level code we define `r := sandwich(p, q)` where `sandwich` is a
built-in function that evaluates to an optimized version of `p q ~p`.
The code generator might produce the following unoptimized code:
```js
// r := sandwich(p, q)
pp_xx = px * px;
pp_xy = px * py;
pp_yx = py * px;
pp_yy = py * py;
r_z   = - pp_xx * qz - pp_yy * qz;
r_xyz = - pp_yx * qz + pp_xy * qz;
```
Notice that in a way we are first multiplying the two occurrences of `p` in the
sandwich and then multiply the result of this (`pp`) with `q`.
This cannot be done on the multivector level, but it is possible on the
component level, where we can apply signs corresponding to basis-vector
permutations in a flexible way.
(Signs cannot yet be applied in the computation of (the components of ) `pp`,
but only in the computation of (the components of) the final result `r`.)

Now the optimization proceeds as follows:
- Drop `pp_yx` and replace it with `pp_xy`, which has the same value.
- In the expression for `r_xyz` detect that it contains the term `pp_xy * qz`
  twice, once with a sign of -1 and once with a sign of +1.
- Transform the expression to
  `(-1 + 1) * (pp_xy * qz) = 0 * (pp_xy * qz) = 0`.
- Drop `r_xyz` as it is known to be 0.
- Drop `pp_xy` as it is no more used.

So the optimized code looks like this:
```js
// r := sandwich(p, q)
pp_xx = px * px;
pp_yy = py * py;
r_z = - pp_xx * qz - pp_yy * qz;
```
The last assignment can be optimized even more to
```js
r_z = (- pp_xx - pp_yy) * qz;
```

Notes on the implementation:
- The optimization does not depend on `p` and `q` having a particular shape
  (such as being 1-vectors as in the example above).
  It works for arbitrary multivectors.  In particular it also works in the
  frequent case where `p` is a rotor.
- Sandwiches of the form `p q ~p` are not detected in the source code.
  Programmers have to write `sandwich(p, q)` explicitly.
  This is clearer anyway.
- The optimization is performed directly during code generation.
  The unoptimized code as an intermediate step and the code transformations
  above are only used for explanatory purposes.
- The implementation supports pseudo-Euclidean metrics.
- Often one "operator" `p` is applied to a bunch of "operands" `q1`, `q2`, ...,
  that is, we have calls `sandwich(p, q1)`, `sandwich(p, q2)`, ...
  The `pp_...` variables above only depend on `p`, not on the second argument
  of `sandwich`.  So, as another optimization, we compute them only once.

  This is achieved by "currying" the `sandwich` function.  The "primary" call
  ```
  sandwich_p := sandwich(p);
  ```
  returns a function (here called `sandwich_p`),
  which can be invoked in "secondary" function calls on the operands:
  ```
  ... := sandwich_p(q1);
  ... := sandwich_p(q2);
  ...
  ```
  The `pp_...` variables are re-used across these calls.

  Actually the primary function call `sandwich(p)` takes a second parameter
  telling which basis blades are expected in the arguments `q1`, `q2`, ...
  of the secondary function calls.
  This allows the primary call to pre-compute precisely the intermediate results
  needed by the secondary calls.
  These intermediate results form the matrix for the linear mapping from
  `q` to `p q ~q`.

## Unsorted

- Straight-forward to extend to pseudo-Euclidean metrics.
- Support not only `p q ~p` but also `p q /p`.
- For a versor `p` the squared norm `|p|**2` can be written as
  `p ~p = p 1 ~p = sandwich(p, 1)`.
  Thus `/p = p / |p|**2 = p / sandwich(p, 1)`.

  With currying we get
  ```js
  p q /p
  // using `/p = ~p / (p ~p)`
  = (p q ~p) / (p ~p)
  = (p q ~p) / (p 1 ~p)
  = sandwich(p, q) / sandwich(p, 1)
  // with `sandwich_p := sandwich(p)`
  = sandwich_p(q) / sandwich_p(1)
  ```
