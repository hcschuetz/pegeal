
for (const file of [
  "introduction",
  "basics",
  "wasm",
  "multi-backend",
  "numbered-coords",

  // While all these examples work, some are redundant or outdated.
  // TODO Clean up examples.

  "homogeneous",
  "homogeneous2",

  "normalization",
  "norm-and-normalization-special-cases",

  "outermorphism",

  "determinants",

  "sandwich",
]) {
  console.log(`
================================================================================`);
  console.log(file);
  console.log();
  await import("./" + file);
}

export {} // make ts happy
