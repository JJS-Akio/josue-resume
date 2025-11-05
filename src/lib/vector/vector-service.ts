import { pipeline, Tensor } from "@huggingface/transformers";

export interface TextToVectorDTO {
  text: string;
  vectors: Tensor;
}

type FeatureExtractionPipeline = (
  input: string | string[],
  options?: Record<string, unknown>
) => Promise<unknown>;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    ) as unknown as Promise<FeatureExtractionPipeline>;
  }

  return extractorPromise;
}

export async function convertTextToEmbedding(
  text: string
): Promise<TextToVectorDTO> {
  const extractor = await getExtractor();
  const vectors = (await extractor(text, {
    pooling: "mean",
    normalize: true,
  })) as Tensor;
  return { text, vectors };
}

export function findSimilarDocs(
  queryEmbedding: Tensor,
  allEmbeddings: Array<{ vectors: Tensor }>
) {
  // TODO: implement similarity search; placeholder for now to keep call sites compiling.
  return { queryEmbedding, allEmbeddings };
}
