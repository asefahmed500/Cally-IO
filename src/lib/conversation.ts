'use server';

import { databases } from '@/lib/appwrite-server';
import { ID, Permission, Query, Role } from 'node-appwrite';
import type { Message } from '@/ai/flows/conversational-chat';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const collectionId = process.env.NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID!;

export type ConversationDocument = {
  docId: string;
  history: Message[];
};

/**
 * Retrieves the conversation history for a given user.
 * @param userId The ID of the user.
 * @returns The conversation document or null if not found.
 */
export async function getConversation(userId: string): Promise<ConversationDocument | null> {
  if (!dbId || !collectionId) {
    throw new Error('Conversation database not configured.');
  }

  try {
    const response = await databases.listDocuments(dbId, collectionId, [
      Query.equal('userId', userId),
      Query.limit(1),
    ]);

    if (response.documents.length > 0) {
      const doc = response.documents[0];
      return {
        docId: doc.$id,
        history: JSON.parse(doc.history),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
}

/**
 * Creates a new conversation history for a user.
 * @param userId The ID of the user.
 * @returns The newly created conversation document.
 */
export async function createConversation(userId: string, initialHistory: Message[] = []): Promise<ConversationDocument> {
  if (!dbId || !collectionId) {
    throw new Error('Conversation database not configured.');
  }
  
  const permissions = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(Role.label('admin')), // Admins can read for support
  ];

  try {
    const doc = await databases.createDocument(
      dbId,
      collectionId,
      ID.unique(),
      {
        userId: userId,
        history: JSON.stringify(initialHistory),
      },
      permissions
    );
    return {
      docId: doc.$id,
      history: initialHistory,
    };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Updates an existing conversation history document.
 * @param docId The ID of the document to update.
 * @param newHistory The new conversation history array.
 */
export async function updateConversation(docId: string, newHistory: Message[]): Promise<void> {
  if (!dbId || !collectionId) {
    throw new Error('Conversation database not configured.');
  }

  try {
    await databases.updateDocument(dbId, collectionId, docId, {
      history: JSON.stringify(newHistory),
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
}
