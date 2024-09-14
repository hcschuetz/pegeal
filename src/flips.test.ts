import { assert, test } from 'vitest';
import { productFlips, reverseFlips } from "../src/Algebra";

const isSorted = (list: string[]): boolean =>
  list.every((elem, i) => i === 0 || list[i-1] <= elem);

/** Count flips while (essentially) bubble-sorting */
function flips_referenceImplementation(listIn: string[]): number {
  const list = [...listIn];
  let flips = 0;

  const len = list.length;
  while (!isSorted(list)) {
    for (let i = 1; i < len; i++) {
      if (list[i-1] > list[i]) {
        [list[i-1], list[i]] = [list[i], list[i-1]];
        flips++;
      }
    }
  }
  return flips;
}

function bitmapToStrings(bm: number): string[] {
  const out = [];
  for (let i = 0; i < 32; i++) {
    if (bm & (1 << i)) out.push(String.fromCharCode("a".charCodeAt(0) + i));
  }
  return out;
}

const randomBitmap = () => Math.floor(2**26 * Math.random());

test("reverseFlips", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < 1000; i++) {
    const bits = randomBitmap(), strings = bitmapToStrings(bits);

    const referenceFlips =
      flips_referenceImplementation([...strings].reverse());

    const actualFlips = reverseFlips(bits);

    assert(
      (actualFlips & 1) === (referenceFlips & 1),
      `mismatch for: ${strings}`
    );
  }
});

test("productFlips", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < 1000; i++) {
    const lBits = randomBitmap(), lStrings = bitmapToStrings(lBits);
    const rBits = randomBitmap(), rStrings = bitmapToStrings(rBits);

    const referenceFlips =
      flips_referenceImplementation([...lStrings, ...rStrings]);

    const actualFlips = productFlips(lBits, rBits);

    assert(
      // We actually only care about the parities:
      // (actualFlips & 1) === (referenceFlips & 1),
      // But it's nice to have full equality:
      actualFlips === referenceFlips,
      `mismatch for: ${lStrings} / ${rStrings}`
    );
  }
});

test("sandwich flipping", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < 1000; i++) {
    const lBits = randomBitmap(), lStrings = bitmapToStrings(lBits);
    const iBits = randomBitmap(), iStrings = bitmapToStrings(iBits);
    const rBits = randomBitmap(), rStrings = bitmapToStrings(rBits);

    const referenceFlips =
      flips_referenceImplementation([
        ...lStrings,
        ...iStrings,
        ...[...rStrings].reverse()
      ]);

    const actualFlips =
      productFlips(lBits, iBits)
    + productFlips(lBits ^ iBits, rBits)
    + reverseFlips(rBits);

    assert(
      (actualFlips & 1) === (referenceFlips & 1),
      `mismatch for: ${lStrings} / ${iStrings} / ${rStrings}`
    );
  }
});
