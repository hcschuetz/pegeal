
for (const file of [
  "introduction",
  "basics",

  // While all these examples work, some are redundant or outdated.
  // TODO Clean up examples.

  "numbered-coords",
  "numbered-coords-long",

  "homogeneous",
  "homogeneous2",

  "unitness-and-exp",

  "multi-backend",

  "normalizability",
  "normalization",
  "norm-and-normalization-special-cases",

  "outermorphism",

  "determinants",

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