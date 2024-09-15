
for (const file of [
  "introduction",

  "basics",
  "outermorphism",
  "determinants",
  "sandwich",
  "homogeneous",

  "numbered-coords",
  "wasm",
  "multi-backend",

  // TODO: Check the following examples for relevance and redundancy.

  "normalization",
  "norm-and-normalization-special-cases",
]) {
  console.log(`
================================================================================`);
  console.log(file);
  console.log();
  await import("./" + file);
}

export {} // make ts happy
