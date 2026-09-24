/**
 * Images a runtime is likely made from (`BO_0289_022`): the Jupyter Docker
 * Stacks, each carrying a kernelspec, and what each holds in a few words.
 * The list is a starting point the form offers; any image can be named
 * instead, since the service takes any image with a kernelspec.
 */
export interface SuggestedImage {
  readonly image: string;
  readonly words: string;
}

export const SUGGESTED_IMAGES: readonly SuggestedImage[] = [
  { image: "jupyter/minimal-notebook", words: "Python, small" },
  { image: "jupyter/scipy-notebook", words: "Python with numpy, pandas, matplotlib, scikit-learn" },
  { image: "jupyter/datascience-notebook", words: "Python, R and Julia" },
  { image: "jupyter/r-notebook", words: "R" },
  { image: "jupyter/tensorflow-notebook", words: "Python with TensorFlow" },
  { image: "jupyter/pytorch-notebook", words: "Python with PyTorch" },
  { image: "jupyter/pyspark-notebook", words: "Python with Spark" },
];

/** The value the form's choice takes for a free-text image. */
export const OTHER_IMAGE = "other";
