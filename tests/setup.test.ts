import { describe, it, expect } from "vitest";

describe("Project Setup", () => {
  it("module can be imported from src/index", async () => {
    const mod = await import("../src/index.js");
    expect(mod).toBeDefined();
  });

  it("DtEvalError is an instance of Error", async () => {
    const { DtEvalError } = await import("../src/errors.js");
    const err = new DtEvalError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DtEvalError");
    expect(err.message).toBe("test");
  });

  it("EvalConfigError extends DtEvalError", async () => {
    const { DtEvalError, EvalConfigError } = await import("../src/errors.js");
    const err = new EvalConfigError("bad config");
    expect(err).toBeInstanceOf(DtEvalError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("EvalConfigError");
  });

  it("EvalMetricError extends DtEvalError", async () => {
    const { DtEvalError, EvalMetricError } = await import("../src/errors.js");
    const err = new EvalMetricError("bad metric");
    expect(err).toBeInstanceOf(DtEvalError);
    expect(err.name).toBe("EvalMetricError");
  });

  it("EvalInputError extends DtEvalError", async () => {
    const { DtEvalError, EvalInputError } = await import("../src/errors.js");
    const err = new EvalInputError("bad input");
    expect(err).toBeInstanceOf(DtEvalError);
    expect(err.name).toBe("EvalInputError");
  });

  it("EvalTimeoutError extends DtEvalError", async () => {
    const { DtEvalError, EvalTimeoutError } = await import("../src/errors.js");
    const err = new EvalTimeoutError("timed out");
    expect(err).toBeInstanceOf(DtEvalError);
    expect(err.name).toBe("EvalTimeoutError");
  });

  it("EvalResponseError extends DtEvalError", async () => {
    const { DtEvalError, EvalResponseError } = await import("../src/errors.js");
    const err = new EvalResponseError("bad response");
    expect(err).toBeInstanceOf(DtEvalError);
    expect(err.name).toBe("EvalResponseError");
  });

  it("all scoring types are importable", async () => {
    const mod = await import("../src/scoring/types.js");
    // Type-only check — ensure the module exports exist
    expect(mod).toBeDefined();
  });

  it("all prompt types are importable", async () => {
    const mod = await import("../src/prompts/types.js");
    expect(mod).toBeDefined();
  });

  it("all engine types are importable", async () => {
    const mod = await import("../src/engine/types.js");
    expect(mod).toBeDefined();
  });
});
