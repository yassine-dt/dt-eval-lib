export class DtEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DtEvalError";
  }
}

export class EvalConfigError extends DtEvalError {
  constructor(message: string) {
    super(message);
    this.name = "EvalConfigError";
  }
}

export class EvalMetricError extends DtEvalError {
  constructor(message: string) {
    super(message);
    this.name = "EvalMetricError";
  }
}

export class EvalInputError extends DtEvalError {
  constructor(message: string) {
    super(message);
    this.name = "EvalInputError";
  }
}

export class EvalTimeoutError extends DtEvalError {
  constructor(message: string) {
    super(message);
    this.name = "EvalTimeoutError";
  }
}

export class EvalResponseError extends DtEvalError {
  constructor(message: string) {
    super(message);
    this.name = "EvalResponseError";
  }
}
