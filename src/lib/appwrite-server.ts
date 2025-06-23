import { Client, Account, Users, Storage, Databases } from 'node-appwrite';

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const appwriteApiKey = process.env.APPWRITE_API_KEY || '';

const client = new Client();

if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
    client
        .setEndpoint(appwriteEndpoint)
        .setProject(appwriteProjectId)
        .setKey(appwriteApiKey);
}

export const account = new Account(client);
export const users = new Users(client);
export const storage = new Storage(client);
export const databases = new Databases(client);
