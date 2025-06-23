import { Client, Account, Users, Storage, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

export const account = new Account(client);
export const users = new Users(client);
export const storage = new Storage(client);
export const databases = new Databases(client);
