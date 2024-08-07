import { bitList, type Context, type Factor, type MultiVector, type Scalar } from "./Algebra.ts";

// TODO Support reordered component names such as "zx" or "e32"?
// But this also means that the corresponding values might need to be negated.

export abstract class AbstractContext<T> implements Context<T> {
  readonly stringToBitmap: Record<string, number> = {};
  readonly bitmapToString: string[];

  constructor(
    bitmapToString: string[],
  ) {
    this.bitmapToString = bitmapToString;
    // TODO check if bitmapToString.length is a power of 2
    const {stringToBitmap} = this;
    bitmapToString.forEach((name, bm) => {
      stringToBitmap[name] = bm;
    });
  }

  abstract invertFactor(f: Factor<T>): Factor<T>;
  abstract makeMultiVector(nameHint: string): MultiVector<T>;
  abstract makeScalar(nameHint: string): Scalar<T>;
}

export function makeLetterNames(
  dims: string[],
  options: {scalar?: string} = {},
): string[] {
  const {scalar = "1"} = options;
  const result: string[] = [];
  const multiDims = 1 << dims.length;
  for (let bm = 0; bm < multiDims; bm++) {
    result[bm] = bm ? bitList(bm).map(i => dims[i]).join("") : scalar;
  }
  return result;
}

export function makeNumberedNames(
  nDims: number,
  options: {start?: 0 | 1, scalar?: string} = {},
): string[] {
  const {start = 0, scalar = "1"} = options;
  const result: string[] = [];
  const separator = (start + nDims) <= 10 ? "" : "_";
  const nMultiDims = 1 << nDims;
  for (let bm = 0; bm < nMultiDims; bm++) {
    result[bm] = bm ? "e" + bitList(bm).map(i => start + i).join(separator) : scalar;
  }
  return result;
}