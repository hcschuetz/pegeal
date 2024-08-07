

Experiences with `node --experimental-strip-type`
-------------------------------------------------

My use case is the following:  I am developing a library which is ultimately
meant to run in the browser.  But during development I am testing much of
its functionality using node.  I am writing TypeScript code so that the editor
can make type-aware suggestions and to get notified about type errors.

I had an `npm test` script that compiles my `.ts` files to `.js` before
invoking node on the latter.
I hoped to simplify this (and to get rid of the generated `.js` files) using
the new `--experimental-strip-type` flag.
This actually worked and I was even able to convince `nodemon` to use `node`
instead of `ts-node` for running `.ts` files
(by creating a file `nodemon.json` with contents `{"execMap": {"ts": "node"}}`).

In my code I had to change three things:
1. Add `.ts` to the module names in `import` statements.
2. Mark type imports with the `type` keyword.
3. Remov the use of
   [parameter properties](https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties).

Item 3 is acceptable, item 2 perhaps even an improvement, but item 1 causes a
problem:
TypeScript itself does not like the `.ts` extensions in `import` statements (by
default).
You can enable the configuration option `allowImportingTsExtensions` to support
the suffix, but then you also have to enable `noEmit` or `emitDeclarationOnly`,
and so no JS code will be emitted when `tsc` is invoked explicitly in the
build process.

It would be cool if `--experimental-strip-type` did not require the `.ts` in
import statements so that the same code could be used
- without a build step by `node --experimental-strip-type` and
- with a build step invoking `tsc`.
