import type { Models } from "node-appwrite";

export interface DocumentMetadata extends Models.Document {
    documentId: string;
    fileName: string;
    userId: string;
}
