# Cally-IO: AI-Powered Conversational Assistant

This is a Next.js application built with Firebase Studio that provides an AI-powered conversational assistant. The assistant, "Cally-IO," can answer questions based on documents you upload, providing a powerful knowledge base for your users or team.

## Tech Stack

- **Framework**: Next.js (with App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **AI**: Google Gemini via Genkit
- **Backend & Database**: Appwrite (for authentication, storage, and database)

## Core Features

- **Secure Authentication**: User signup and login functionality powered by Appwrite.
- **Intelligent Document Management**: Users can upload PDF, DOCX, and TXT files through the chat interface.
- **AI-Powered RAG Chat**: The AI assistant uses Retrieval-Augmented Generation (RAG) to find information within the uploaded documents and provide context-aware answers.
- **Conversation Intelligence**: The AI can recognize when it doesn't have an answer and suggest escalating to a human expert.
- **Performance Analytics**: A dedicated dashboard tracks key metrics like user satisfaction and resolution rates.
- **Responsive Design**: The UI is designed to work seamlessly on both desktop and mobile devices.

## Getting Started

### 1. Prerequisites

- Node.js (v18 or later)
- An Appwrite project
- A Google AI API Key

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd <repository-name>
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of your project and add the following environment variables.

```
# Google AI
GOOGLE_API_KEY=your_google_api_key

# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id
APPWRITE_API_KEY=your_appwrite_api_key

# Appwrite Database & Storage
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID=your_storage_bucket_id
NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID=your_embeddings_collection_id
```

See the **Appwrite Setup** section below for details on how to get these values.

### 4. Appwrite Setup

To make the application fully functional, you need to configure your Appwrite project:

1.  **Storage Bucket**: In your Appwrite Console, go to **Storage** and create a new bucket. Copy its **Bucket ID** and add it to your `.env` file.
2.  **Database**: Go to **Databases** and create a new database. Copy its **Database ID** to your `.env` file.
3.  **Embeddings Collection**:
    *   Inside your database, create a new collection for embeddings. Copy its **Collection ID** to your `.env` file.
    *   In the collection **Attributes** tab, add the following:
        *   `documentId` (string, size: 255, required)
        *   `fileName` (string, size: 255, required)
        *   `chunkText` (string, size: 4096, required)
        *   `embedding` (float, required, **array** enabled with size 768)
        *   `userId` (string, size: 255, required)
    *   In the **Indexes** tab, create an index on `userId`.
    *   In the **Settings** tab, grant **Read, Create, Update, Delete** access to "All Users (role:member)".

### 5. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## How It Works

1.  **Authentication**: Users create an account or log in. Appwrite handles the session management.
2.  **Document Upload**: In the chat panel on the dashboard, users can upload documents. These files are sent to Appwrite Storage.
3.  **Processing Flow**: A Genkit flow (`processDocument`) is triggered. It extracts text from the document, splits it into chunks, generates embeddings for each chunk using Google's AI model, and stores the chunks and their embeddings in the Appwrite database.
4.  **Chat Interaction**: When a user asks a question, the `conversationalRagChat` flow is initiated. It generates an embedding for the user's question and queries the Appwrite database to find the most similar document chunks (semantic search).
5.  **Response Generation**: The relevant document chunks are passed as context to the Gemini model, which generates a final, helpful answer for the user.