# Cally-IO: AI-Powered Conversational Assistant

This is a Next.js application that provides a feature-rich, AI-powered conversational assistant. Built with a modern tech stack, "Cally-IO" can answer questions from a dynamic knowledge base, manage sales leads through a visual pipeline, and provide detailed analytics—all configurable by an administrator.

## Tech Stack

- **Framework**: Next.js (with App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **AI**: Google Gemini via Genkit
- **Backend & Database**: Appwrite (for authentication, storage, and database)
- **Calling**: Twilio (for automated calling features)

## Core Features Checklist

- [x] **Secure Authentication**: User signup, login, and password recovery.
- [x] **Role-Based Access Control**: `user` and `admin` roles with protected routes.
- [x] **Lead Management Pipeline**: Visual Kanban board to track leads.
- [x] **Knowledge Base Management**: Admins can manage all documents and a company-wide FAQ.
- [x] **Persistent Chat History**: Conversations are saved, supporting multi-session and multi-device use.
- [x] **Configurable AI Agent**: Admins control the AI's personality, response style, and business instructions.
- [x] **Editable Call Script Templates**: Admins create master call scripts for the AI to use.
- [x] **Business Hours**: Admins can set operating hours and an away message.
- [x] **AI-Powered RAG Chat**: The AI uses Retrieval-Augmented Generation to answer questions from documents and FAQs.
- [x] **AI Script Generator**: Dynamically generates personalized call scripts for leads.
- [x] **Conversation Intelligence**: Escalates to a human when it can't find an answer.
- [x] **Performance Analytics**: A real-time, admin-only dashboard tracks key metrics with charts.
- [x] **CRM & Integration Hub**: UI placeholders for connecting to external services like Slack or Google Sheets.
- [x] **Responsive Design**: The UI works seamlessly on both desktop and mobile devices.

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

Create a `.env` file in the root of your project and add the necessary environment variables. See `documentation.txt` for a complete list of required variables and their descriptions.

### 4. Appwrite Setup

To make the application fully functional, you must configure your Appwrite project with the required database collections and storage buckets. For a detailed, step-by-step guide on setting up the necessary attributes and permissions, please refer to the **Appwrite Setup** section in `/documentation.txt`.

### 5. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result. To create your admin account, sign up using the email you specified in the `ADMIN_EMAIL` environment variable.
