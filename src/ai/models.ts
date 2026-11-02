import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

export const CHAT_MODEL_NAME = 'gemini-2.5-flash';
export const EMBEDDING_MODEL_NAME = 'text-embedding-004';

export function isAIConfigured(): boolean {
  return !!process.env.GOOGLE_API_KEY;
}

let _chatModel: ChatGoogleGenerativeAI | null = null;

/** Shared Gemini chat model instance (free tier friendly). */
export function getChatModel(): ChatGoogleGenerativeAI {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
  }
  if (!_chatModel) {
    _chatModel = new ChatGoogleGenerativeAI({
      model: CHAT_MODEL_NAME,
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.4,
      maxRetries: 2,
    });
  }
  return _chatModel;
}

let _embeddings: GoogleGenerativeAIEmbeddings | null = null;

/** Shared Gemini embeddings instance (text-embedding-004, 768 dims). */
export function getEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
  }
  if (!_embeddings) {
    _embeddings = new GoogleGenerativeAIEmbeddings({
      model: EMBEDDING_MODEL_NAME,
      apiKey: process.env.GOOGLE_API_KEY,
      maxRetries: 2,
    });
  }
  return _embeddings;
}
