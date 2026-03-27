import type { ScoringScale, Score } from "./types";
import { EvalInputError } from "../errors";

/**
 * Compute a score from a raw value using a scoring scale.
 * Optionally override the scale's default threshold.
 */
export function computeScore(
  value: number,
  scale: ScoringScale,
  thresholdOverride?: number,
): Score {
  const [min, max] = scale.range;
  if (value < min || value > max) {
    throw new EvalInputError(
      `Score value ${value} is out of range [${min}, ${max}]`,
    );
  }

  if (thresholdOverride !== undefined &&
      (Number.isNaN(thresholdOverride) || thresholdOverride < min || thresholdOverride > max)) {
    throw new EvalInputError(
      `Threshold override ${thresholdOverride} is out of range [${min}, ${max}]`,
    );
  }

  const threshold =
    thresholdOverride !== undefined ? thresholdOverride : scale.threshold;
  const label: Score["label"] = value >= threshold ? "pass" : "fail";

  return { value, label };
}
