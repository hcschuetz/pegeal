
for (const file of [
  "introduction",

  "basics",
  "products",

  "numbered-coords",
  "numbered-coords-long",

  "homogeneous",
  "homogeneous2",

  "blade-squaring",
  "blade-exponentiation",
  "unitness-and-exp",

  "rotation",
  "rotor-log",
  "rotor-log-2",
  "slerp1",
  "slerp2",

  "normalizability",
  "normalization",
  "norm-and-normalization-special-cases",

  "outermorphism",

  "determinants",

  "precalc",

  "sandwich",

  "inverse-check",

  "wasm",
]) {
  console.log(`
================================================================================`);
  console.log(file);
  console.log();
  await import("./" + file);
}

export {} // make ts happy