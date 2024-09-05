Sandwich Optimization
---------------------

Consider the sandwich product `r := p q ~p` with vectors `p:= a ex + b ey` and
`q := c ez`.
`r` can be computed as:
```js
r
= p q ~p
= (a ex + b ey) (c ez) ~(a ex + b ey)
= (a ex + b ey) (c ez) (a ex + b ey)
= a c a ex ez ex + a c b ex ez ey + b c a ey ez ex + b c b ey ez ey
= - a a c ez - a b c ex ey ez + a b c ex ey ez - b b c ez
= - a a c ez - b b c ez
= (- a a c - b b c) ez
```
Notice that in one step the terms `- a b c ex ey ez` and `+ a b c ex ey ez`
cancelled each other out.

Straight-forward code generation uses an intermediate step `aux := p q`
and a second step `r := aux ~p` or just `r := aux p` as `p` is a 1-vector.
On the coordinate level this looks like this:
```js
// p := a ex + b ey
p_x = a;
p_y = b;

// q := c ez
q_z = c;

// aux := p q
aux_xz = p_x * q_z;
aux_yz = p_y * q_z;

// r := aux p
r_z   = - aux_xz * p_x - aux_yz * p_y;
r_xyz = - aux_xz * p_y + aux_yz * p_x;
```

At run-time `r_xyz` will always evaluate to 0, but a local code generator for
`r := aux p` does know this.

This leads to two problems:
- The computation of `r_xyz` is wasted.
- Perhaps more importantly, subsequent computations involving `r` will produce
  more superfluous code using `r_xyz`.

So we should avoid the computation of `r_xyz`.  How can we do this?

The code generator for `r := aux p` might look up the definitions of `aux_xz`
and `aux_yz`, inline them in the definition of `r_xyz`, simplify the expression
to 0, and therefore drop the component `r_xyz`.
But searching for optimization opportunities like this in general would be quite
an effort.

To detect such optimization opportunities more easily,
we make use of the fact that this problem typically arises in sandwich
products, which are used frequently in geometric algebra.

In the high-level code we define `r := sandwich(p, q)` where `sandwich` is a
built-in function that evaluates to an optimized version of `p q ~p`.
The code generator might produce the following unoptimized code:
```js
// r := sandwich(p, q)
aux1 = p_x * p_x;
aux2 = p_x * p_y;
aux3 = p_y * p_x;
aux4 = p_y * p_y;
r_z   = - aux1 * q_z - aux4 * q_z;
r_xyz = - aux3 * q_z + aux2 * q_z;
```
Now the optimization proceeds as follows:
- Drop `aux3` and replace it with `aux2`, which has the same value.
- In the expression for `r_xyz` detect that it contains the term `aux2 * q_z`
  twice, once with a sign of -1 and once with a sign of +1.
- Transform the expression to `(-1 + 1) * (aux2 * q_z) = 0 * (aux2 * q_z) = 0`.
- Drop `r_xyz` as it is known to be 0.
- Drop `aux2` as it is no more used.

So the optimized code looks like this:
```js
// r := sandwich(p, q)
aux1 = p_x * p_x;
aux4 = p_y * p_y;
r_z = - aux1 * q_z - aux4 * q_z;
```
Notice that this could be optimized even more to
```js
// r := sandwich(p, q)
aux1 = p_x * p_x;
aux4 = p_y * p_y;
r_z = - (aux1 + aux4) * q_z;
```
but this step has not yet been implemented.  (It is only a minor optimization
and not needed to get rid of `r_xyz`.)

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
  The `aux...` variables above only depend on `p`, not on the second argument
  of `sandwich`.  So, as another optimization, we compute them only once.

  This is achieved by "currying" the `sandwich` function.  The first call
  ```
  sandwich_p := sandwich(p);
  ```
  returns a function which can be invoked in turn with the operands:
  ```
  ... := sandwich_p(q1);
  ... := sandwich_p(q2);
  ...
  ```
  The `aux...` variables are re-used across these calls.

## Unsorted

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
