
for (const file of [
  "introduction",

  "basics",
  "outermorphism",
  "determinants",

  "numbered-coords",
  "wasm",
  "multi-backend",

  // TODO: Check the following examples for relevance and redundancy.

  "homogeneous",
  "homogeneous2",

  "normalization",
  "norm-and-normalization-special-cases",

  "sandwich",
]) {
  console.log(`
================================================================================`);
  console.log(file);
  console.log();
  await import("./" + file);
}

export {} // make ts happy
