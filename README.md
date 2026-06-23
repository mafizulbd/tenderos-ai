# TenderOS AI

TenderOS AI is a Dockerized AI-powered tender analysis and proposal drafting MVP.

## Features

- Tender PDF/TXT upload
- AI tender analysis
- Executive summary
- Eligibility criteria extraction
- Required document checklist
- Compliance matrix
- Risk analysis
- Tender submission draft
- Final submission checklist
- PostgreSQL storage
- Dockerized frontend, backend, and database

## Tech Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- AI: Google Gemini API
- PDF Parser: PyMuPDF
- DOCX Export: python-docx
- Containerization: Docker Compose

## Project Structure

```text
tenderos-ai/
├── backend/
│   ├── Dockerfile
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── hermes_client.py
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── app/
│       ├── page.tsx
│       └── globals.css
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
