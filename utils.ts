import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { timeout, indexName } from "./config";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatGroq } from "@langchain/groq";
import {
  CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT,
  QA_CHAIN_PROMPT,
} from "./prompts";

export const client = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

export const createPineconeIndex = async (
  client: Pinecone,
  indexName: string,
  vectorDimension: number
) => {
  const existingIndexes = await client.listIndexes();

  // check if the index exists on Pinecone before creating it or not
  const indexExists = existingIndexes.indexes?.some((index) => index.name === indexName);
  if (!indexExists) {
    await client.createIndex({
      name: indexName,
      dimension: vectorDimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    // wait for index creation to be complete on Pinecone before proceeding
    await new Promise((resolve) => setTimeout(resolve, timeout));
  }
};

export const updatePinecone = async (client: Pinecone, indexName: string, docs: any[]) => {
  const index = client.index(indexName);

  for (const doc of docs) {
    const txtPath = doc.metadata.source;
    const text = doc.pageContent;

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });

    const chunks = await textSplitter.createDocuments([text]);

    const embeddingsArray = await embeddings.embedDocuments(
      chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " "))
    );

    // create and upsert vectors in batches of 100
    const batchSize = 100;
    let batch: any = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const vector = {
        id: `${txtPath}_${idx}`,
        values: embeddingsArray[idx],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          txtPath: txtPath,
        },
      };
      batch = [...batch, vector];

      // when batch is full or it's the last item, upsert the vectors
      if (batch.length === batchSize || idx === chunks.length - 1) {
        await index.upsert(batch);
        // empty the batch
        batch = [];
      }
    }
  }
};

let _chain: ConversationalRetrievalQAChain | null = null;

export async function getChain() {
  if (_chain) return _chain;

  console.log("Initializing chain...");
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const index = client.index(indexName);

  const vectorStore = await PineconeStore.fromExistingIndex(
    embeddings,
    {
      pineconeIndex: index,
      textKey: "pageContent",
    }
  );

  const retriever = vectorStore.asRetriever();

  _chain = ConversationalRetrievalQAChain.fromLLM(
    llm,
    retriever,
    {
      returnSourceDocuments: true,
      questionGeneratorChainOptions: {
        template: CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT,
      },
      qaChainOptions: {
        type: "stuff",
        prompt: QA_CHAIN_PROMPT
      },
    }
  );
  console.log("Chain initialized successfully.");
  return _chain;
}
