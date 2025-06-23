import type { Models } from "node-appwrite";

export interface DocumentChunk extends Models.Document {
    documentId: string;
    fileName: string;
    chunkText: string;
    userId: string;
}

export interface DocumentMetadata extends DocumentChunk {}


export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: DocumentChunk[];
}
