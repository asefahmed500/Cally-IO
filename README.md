# Cally-IO: AI-Powered Conversational Sales Platform

Cally-IO is a feature-complete, production-ready Next.js application designed to serve as an intelligent sales and support co-pilot. It leverages a modern tech stack to provide a seamless and intelligent user experience, allowing users to get answers from a knowledge base of their own documents, manage sales leads through a visual pipeline, and track performance with real-time analytics—all configurable by an administrator.

## Tech Stack

- **Framework**: Next.js (with App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **AI**: Google Gemini via Genkit
- **Backend & Database**: Appwrite (for authentication, storage, and database)
- **Calling**: Twilio (for automated calling features)

## Core Features Checklist

- [x] **Secure Authentication**: User signup, login, and password recovery.
- [x] **Role-Based Access Control**: `user` and `admin` roles with protected routes.
- [x] **In-App User Management**: Admins can add, remove, and manage user roles directly within the application.
- [x] **Lead Management Pipeline**: Visual Kanban board for all users, with role-based data visibility and lead-claiming for agents.
- [x] **Full Lead CRUD**: Agents can create, read, update, and delete their own leads with detailed profiles (phone, company, notes).
- [x] **Follow-up Scheduling**: Agents can schedule follow-up dates and add notes for each lead, with visual reminders for overdue tasks.
- [x] **Knowledge Base Management**: Admins can manage all documents and a company-wide FAQ.
- [x] **Persistent Chat History**: Conversations are saved, supporting multi-session and multi-device use.
- [x] **Configurable AI Agent**: Admins control the AI's personality, response style, and business instructions.
- [x] **Editable Call Script Templates**: Admins create master call scripts for the AI to use.
- [x] **Business Hours**: Admins can set operating hours and an away message.
- [x] **AI-Powered RAG Chat**: The AI uses Retrieval-Augmented Generation to answer questions from documents and FAQs.
- [x] **AI Script Generator**: Dynamically generates personalized call scripts for leads.
- [x] **Automated AI Calling**: The system can place automated outbound calls using Twilio, where an AI voice reads the generated script.
- [x] **Conversation Intelligence**: The system uses speech recognition to understand the lead's response and can escalate to a human when it can't find an answer.
- [x] **Performance Analytics**: Real-time admin and agent dashboards track key metrics with charts.
- [x] **Advanced Analytics**: Provides "Content Suggestions" based on unanswered questions and "Usage Statistics" for documents.
- [x] **CRM & Integration Hub**: A functional webhook for connecting to external services like Slack or Google Sheets.
- [x] **Responsive Design**: The UI works seamlessly on both desktop and mobile devices.
- [x] **Multi-Modal Chat**: Users can upload images and play back AI responses as audio (Text-to-Speech).

## Getting Started

### 1. Prerequisites

- Node.js (v18 or later)
- [ngrok](https://ngrok.com/) or another tunneling service (for testing Twilio webhooks locally)
- An Appwrite project
- A Google AI API Key
- A Twilio account with a purchased phone number

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd <repository-name>
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of your project and add the necessary environment variables. See `documentation.txt` for a complete list of required variables and their descriptions. Crucially, you must set `NEXT_PUBLIC_BASE_URL` to your public-facing URL for Twilio webhooks to work.

### 4. Appwrite Setup

To make the application fully functional, you must configure your Appwrite project with the required database collections and storage buckets. For a detailed, step-by-step guide on setting up the necessary attributes and permissions, please refer to the **Appwrite Setup** section in `/documentation.txt`.

### 5. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

If you are testing the Twilio calling feature locally, you must expose your local server to the internet. Open another terminal and run:
```bash
ngrok http 9002
```
Copy the public HTTPS URL provided by ngrok and set it as the value for `NEXT_PUBLIC_BASE_URL` in your `.env` file.

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result. To create your admin account, sign up using the email you specified in the `ADMIN_EMAIL` environment variable.
# Cally-IO
