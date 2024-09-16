Outermorphism
-------------

(See also [DFM09], chapter 4.)

Applying a linear mapping `f` to a multivector `A`:

```js
f(A)
= // Let A := ∑{b ∈ A.baseblades} A_b b
  // Each b is a set of base vectors (technically represented as a bitmap,
  // logically a wedge product in "standard" order).
  // It is also used as an index in A to access the corresponding
  // magnitude A_b.
f(∑{b ∈ A.baseblades} A_b b)
= // linearity
∑{b ∈ A.baseblades} A_b f(b)
= // Let b := ⋀{e_i ∈ b} e_i
  // e_i is the i-th base vector in the domain
∑{b ∈ A.baseblades} A_b f(⋀{e_i ∈ b} e_i)
= // distribute f over the wedge product
∑{b ∈ A.baseblades} A_b ⋀{e_i ∈ b} f(e_i)
= // Let f be given as matrix M:
  //   f(e_i) = ∑{j} M_ji E_j
  // with
  // i: column index, j: row index
  // E_j: j-th base vector in the co-domain
∑{b ∈ A.baseblades} A_b ⋀{e_i ∈ b} ∑{j} M_ji E_j
                        -------------------------
```

We implement the underlined expression
- recursively along the domain basis (`e_i ∈ b`) and
- iteratively along the co-domain basis (`j`).

Recursion terminates in multiple ways:
- Without contributing a value if `M_ji === 0` (or missing in a sparse matrix).
- Without contributing a value if `E_j` is already in the recursion path.
- Contributing a value if the end of the bitmap b has been reached,
  that is, `(1 << i) > b`.

Parameters of the recursive function:
- The current value of `i`.  (Skip `i` values that are not set in `b`.)
- The accumulated bitmap of `E_j` indices so that
  - duplicate `E_j` can be detected and
  - the accumulated value will be contributed to the output component
    corresponding to the accumulated bitmap.
- The accumulated number of flips (adjacent transpositions)
  for permuting the output basis vectors into the proper order.
- An accumulated product:
  - Start with `A_b` and
  - multiply with `M_ji` in each recursion step.
    (The multiplication is done lazily to avoid code generation if all
    sub-branches of the recursion should fail.)
