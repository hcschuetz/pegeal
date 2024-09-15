import { expect, test } from "vitest";
import { expectNearby, forAlgebras } from "./test-utils";

forAlgebras(alg => {
  test("rotor vs. slerp - dummy back end", () => {
    const aNorm = alg.normalize(alg.mv("a", {x: 0.7, y: 0.8, z: 0.9}));
    const bNorm = alg.normalize(alg.mv("b", {x: -0.4, y: 0.5, z: 0.2}));
    const nSteps = 7;

    const phi = alg.getAngle(aNorm, bNorm);

    const blade = alg.scale(1/2, alg.log(alg.geometricProduct(bNorm, aNorm)));
    const rotor = alg.exp(alg.scale(1 / nSteps, blade));
    const rotate = alg.sandwich(rotor, ["x", 2, "z"]);

    const slerp = alg.slerp(aNorm, bNorm);

    let cByRotor = aNorm;
    for (let i = 0; i <= nSteps; i++) {
      const cBySlerp = slerp(i / nSteps);
      expectNearby(cBySlerp, cByRotor);
      expect(cBySlerp.knownUnit).toBe(true);

      expect(alg.getAngle(aNorm, cBySlerp)).toBeCloseTo(phi * (i / nSteps));
      expect(alg.getAngle(bNorm, cBySlerp)).toBeCloseTo(phi * (1 - (i / nSteps)));

      const cByRotorNew = rotate(cByRotor);
      expect(alg.getAngle(cByRotor, cByRotorNew)).toBeCloseTo(phi / nSteps);
      expect(cByRotorNew.knownUnit).toBe(true);
      cByRotor = cByRotorNew;
    }
  });
});

// TODO Rotate something that is not a 1-vector (such as another rotor).

// TODO Make the same with the WASM backend and symbolic input vectors,
// then run the WASM code with numeric inpug to see if we get the same results.
