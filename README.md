# Cally-IO: AI-Powered Conversational Assistant

This is a Next.js application built with Firebase Studio that provides an AI-powered conversational assistant. The assistant, "Cally-IO," can answer questions based on documents you upload, providing a powerful knowledge base for your users or team.

## Tech Stack

- **Framework**: Next.js (with App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **AI**: Google Gemini via Genkit
- **Backend & Database**: Appwrite (for authentication, storage, and database)
- **Calling**: Twilio (for automated calling features)

## Core Features

- **Secure Authentication**: User signup and login functionality powered by Appwrite.
- **Role-Based Access Control**: Differentiates between `user` and `admin` roles, ensuring data privacy and proper access levels.
- **Lead Management Pipeline**: An admin-only dashboard with a visual Kanban board to view, manage, track, and export leads through the sales funnel.
- **Intelligent Document Management**: Users can upload PDF, DOCX, and TXT files. Data is isolated so users can only access their own documents, while admins have read-access for oversight.
- **Persistent Chat History**: Conversations are saved and synced across devices for a seamless user experience.
- **AI-Powered RAG Chat**: The AI assistant uses Retrieval-Augmented Generation (RAG) to find information within the uploaded documents and provide context-aware answers.
- **Curated FAQ Knowledge Base**: Admins can create and manage a set of Frequently Asked Questions that the AI will prioritize as its primary source of truth.
- **AI Script Generator**: Admins can edit a master call script template, and the AI will use it to dynamically generate personalized call scripts for leads.
- **Conversation Intelligence**: The AI can recognize when it doesn't have an answer and suggest escalating to a human expert.
- **Performance Analytics**: A dedicated, admin-only dashboard tracks key metrics like user satisfaction and resolution rates, powered by real user feedback.
- **Responsive Design**: The UI is designed to work seamlessly on both desktop and mobile devices.

## Getting Started

### 1. Prerequisites

- Node.js (v18 or later)
- An Appwrite project
- A Google AI API Key
- A Twilio account (optional, for calling features)

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
NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID=your_metrics_collection_id
NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID=your_leads_collection_id
NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID=your_conversations_collection_id
NEXT_PUBLIC_APPWRITE_FAQS_COLLECTION_ID=your_faqs_collection_id
NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID=your_settings_collection_id

# Admin User
# The email address for the first admin user. When a user signs up with this email,
# they will be automatically assigned the 'admin' role.
ADMIN_EMAIL=youradminemail@example.com

# Twilio Configuration (Optional)
# Required for the Automated Calling feature.
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
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
    *   In the **Settings** tab, update the **Permissions**. This is a critical security step. Set the permissions as follows:
        *   **Create Access**: Add `All Users (role:member)`. This allows any logged-in user to create documents.
        *   **Read Access, Update Access, Delete Access**: Leave these **empty**. Access for these operations will be controlled by secure, document-level permissions set by the application, ensuring users can only access their own data.
4.  **Metrics Collection**:
    *   Inside the same database, create another new collection for metrics. Copy its **Collection ID** to your `.env` file.
    *   In the **Attributes** tab, add the following:
        *   `userId` (string, size: 255, required)
        *   `messageId` (string, size: 255, required)
        *   `feedback` (string, size: 255, required)
    *   In the **Indexes** tab, create an index on `userId`.
    *   In the **Settings** tab, update the **Permissions** similar to the embeddings collection.
5.  **Leads Collection**:
    *   Inside the same database, create a third collection for leads. Copy its **Collection ID** to your `.env` file.
    *   In the **Attributes** tab, add the following:
        *   `userId` (string, size: 255, required)
        *   `name` (string, size: 255, required)
        *   `email` (string, size: 255, required)
        *   `status` (string, size: 255, required)
        *   `score` (integer, required)
        *   `lastActivity` (datetime, required)
    *   In the **Indexes** tab, create an index on `userId` and `email`.
    *   In the **Settings** tab, update the **Permissions**. This collection is managed by the server, so you should only grant permissions to the **`admin`** role for all CRUD operations. Leave the user-facing permissions empty.
6.  **Conversations Collection**:
    * Inside the same database, create a new collection for chat history. Copy its **Collection ID** to your `.env` file.
    * In the **Attributes** tab, add the following:
        * `userId` (string, size: 255, required)
        * `history` (string, size: 1000000, required, default: `[]`)
    * In the **Indexes** tab, create an index on `userId`.
    * In the **Settings** tab, update the **Permissions** so users can manage their own history.
        * **Create Access**: `All Users (role:member)`
        * **Read, Update, Delete Access**: Set these on a per-document basis using `Role.user(userId)`. The application handles this automatically. Grant `Team (admin)` read access for support.
7.  **FAQs Collection**:
    *   Inside the same database, create a new collection for FAQs. Copy its **Collection ID** to your `.env` file.
    *   In the **Attributes** tab, add the following:
        *   `question` (string, size: 255, required)
        *   `answer` (string, size: 8192, required)
    *   In the **Settings** tab, update the **Permissions** as follows:
        *   **Read Access**: `Any (role:all)`. This is important so the AI can read the FAQs.
        *   **Create, Update, Delete Access**: `Team (admin)`. This ensures only admins can manage the FAQs.
8.  **Settings Collection**:
    *   Inside the same database, create a fourth collection for AI settings. Copy its **Collection ID** to your `.env` file.
    *   In the **Attributes** tab, add the following:
        *   `ai_personality` (string, size: 255, required)
        *   `ai_style` (string, size: 255, required)
        *   `ai_instructions` (string, size: 8192, required)
        *   `business_hours_enabled` (boolean, required, default `false`)
        *   `business_hours_start` (string, size: 5, required, default `09:00`)
        *   `business_hours_end` (string, size: 5, required, default `17:00`)
        *   `business_hours_timezone` (string, size: 255, required, default `UTC`)
        *   `away_message` (string, size: 1024, required, default `We are currently away...`)
        *   `call_script_template` (string, size: 8192, optional)
    *   In the **Settings** tab, update the **Permissions** to be `Team (admin)`-only for all operations.
    *   Go to the **Documents** tab and create a single document. Enter `default_config` as the Document ID. Fill in initial values for the attributes. The application will use this document to configure the AI.

### 5. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.
To create your admin account, sign up using the email you specified in the `ADMIN_EMAIL` environment variable.

## How It Works

1.  **Authentication & Roles**: Users create an account. The system assigns a `user` label. If the email matches the `ADMIN_EMAIL`, it also assigns an `admin` label.
2.  **Lead Creation**: When a new user signs up, a corresponding document is created in the `leads` collection, accessible only by admins.
3.  **Document Upload**: In the chat panel, users upload documents. These are sent to Appwrite Storage with permissions allowing access only for that user and read access for admins.
4.  **Processing Flow**: A Genkit flow (`processDocument`) is triggered. It extracts text, generates embeddings, and stores them in the Appwrite database with the same secure, document-level permissions.
5.  **Chat Interaction & History**: When a user asks a question, the backend fetches their past conversation history from the `user_conversations` collection.
6.  **Response Generation**: The AI first fetches all curated FAQs from the database. These FAQs, along with relevant document chunks, the full conversation history, and the user's question, are passed as context to the Gemini model to generate a helpful answer.
7. **History Persistence**: The new user question and the AI's final response are saved back to the database, ensuring the conversation can be resumed on any device.
8.  **Feedback Loop**: Users can rate AI responses. This feedback is logged to a `metrics` collection in Appwrite via the `logInteraction` flow.
9.  **Script Generation**: From the leads dashboard, an admin can trigger the `initiateCall` flow. The flow fetches the master script template (editable in the Admin Control Panel) and combines it with lead data to create a personalized script.
10. **Analytics & Leads**: Admin dashboards query the `metrics` and `leads` collections to provide live data on user satisfaction and to manage the customer lifecycle in a visual pipeline.
