import { expect, test } from 'vitest';
import { bitCount, productFlips, reverseFlips } from "../src/Algebra";

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

const repeats = 300;

test("bitCount", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < repeats; i++) {
    const bits = randomBitmap(), strings = bitmapToStrings(bits);
    expect(bitCount(bits), `${strings}`).toBe(strings.length);
  }
});

test("reverseFlips", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < repeats; i++) {
    const bits = randomBitmap(), strings = bitmapToStrings(bits);

    const referenceFlips =
      flips_referenceImplementation([...strings].reverse());

    const actualFlips = reverseFlips(bits);

    expect(actualFlips & 1, `${strings}`)
    .toBe(referenceFlips & 1);
  }
});

test("productFlips", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < repeats; i++) {
    const lBits = randomBitmap(), lStrings = bitmapToStrings(lBits);
    const rBits = randomBitmap(), rStrings = bitmapToStrings(rBits);

    const referenceFlips =
      flips_referenceImplementation([...lStrings, ...rStrings]);

    const actualFlips = productFlips(lBits, rBits);

    // We actually only care about the parities,
    // but it's nice to have full equality:
    expect(actualFlips, `${lStrings} / ${rStrings}`)
    .toBe(referenceFlips);
  }
});

test("sandwich flipping", () => {
  // Run a bunch of random test cases
  for (let i = 0; i < repeats; i++) {
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

    expect(actualFlips & 1, `${lStrings} / ${iStrings} / ${rStrings}`)
    .toBe(referenceFlips & 1);
  }
});
