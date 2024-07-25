export interface MultiVector {
  /**
   * Map component bitmap (e.g. 0b101 = 5) to variable name (e.g. "a_123_xz").
   * Missing/undefined entries stand for components with an implicit value of 0.
   */
  readonly coords: string[];

  get(key: number | string): string;
}

export interface Algebra {
  dimension: number;

  zero(): MultiVector;
  one(): MultiVector;
  pseudoScalar(): MultiVector;
  pseudoScalarInv(): MultiVector;
  basis(): MultiVector[];
  /**
   * Create a multivector from an object `obj` which maps coordinates to
   * (target-code) expressions.
   */
  mv(obj: Record<string, string>): MultiVector;

  // TODO Move the methods taking a single MultiVector to the MultiVector class?

  /** The scalar `alpha` should be given as a target-code expression. */
  scale(alpha: string, mv: MultiVector): MultiVector;
  negate(mv: MultiVector): MultiVector;
  gradeInvolution(mv: MultiVector): MultiVector;
  reverse(mv: MultiVector): MultiVector;
  dual(mv: MultiVector): MultiVector;
  extractGrade(grade: number, mv: MultiVector): MultiVector;

  plus(...mvs: MultiVector[]): MultiVector;
  wedge(...mvs: MultiVector[]): MultiVector;
  contract(a: MultiVector, b: MultiVector): MultiVector;
  scalarProd(a: MultiVector, b: MultiVector): MultiVector;
  geomProd(a: MultiVector, b: MultiVector): MultiVector;
}
