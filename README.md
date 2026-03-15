
# Final Project

A comprehensive dataset generation platform with FastAPI backend and React frontend.

## Setup Instructions

### 1. Create Virtual Environment and Install Dependencies

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Complete Setup

Run the setup script to complete the initial configuration:

```bash
python setup.py
```

**Note:** Make sure your virtual environment is activated before running the setup script.

### 3. Run FastAPI Server

Start the backend server in development mode:

```bash
fastapi dev server.py
```

Test the API endpoints using the interactive docs at: `http://localhost:8000/docs`

### 3.1 Supabase Setup (Dashboard + Retry History)

To store generation stats/history in Supabase and enable retry-from-history:

1. Add these environment variables to `.env`:

```bash
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_KEY=<your_supabase_service_role_or_backend_key>
```

2. Create the required table in Supabase SQL editor using the schema from backend endpoint:

```text
GET /dashboard/schema_sql
```

3. Validate DB connection status from backend:

```text
GET /dashboard/database_status
```

If Supabase is not configured, dataset generation still works, but dashboard history and retry persistence are unavailable.

### 4. Run Frontend

Navigate to the frontend directory and start the React app:

```bash
cd frontend/final_project_frontend
npm run dev
```

For production builds:

```bash
npm run build
```

## Project Structure

```
├── core
│   ├── generate.py
│   └── openrouter_sythesis.py
├── data
│   └── datasets
│       ├── Mock_general.csv
│       ├── Mock_instruction.csv
│       ├── Mock_knowledge.csv
│       ├── Mock_math.csv
│       ├── Mock_reasoning.csv
│       └── Mock_tool.csv
├── frontend
│   └── final_project_frontend
│       ├── public
│       │   └── vite.svg
│       ├── src
│       │   ├── assets
│       │   ├── components
│       │   │   ├── csv-preview
│       │   │   │   └── CsvPreviewTable.tsx
│       │   │   ├── generate-datasets
│       │   │   │   ├── ModelConfigForm.tsx
│       │   │   │   ├── ModelFuzzyPicker.tsx
│       │   │   │   └── PersonaSplitDropdown.tsx
│       │   │   ├── MainContent.tsx
│       │   │   └── Sidebar.tsx
│       │   ├── data
│       │   │   └── navigation.tsx
│       │   ├── lib
│       │   │   ├── api.ts
│       │   │   ├── csvPreviewSources.ts
│       │   │   ├── fuzzy.ts
│       │   │   ├── openrouterModels.ts
│       │   │   └── providerEndpoints.ts
│       │   ├── pages
│       │   │   ├── GenerateDatasetsPage.tsx
│       │   │   ├── HomePage.tsx
│       │   │   ├── LandingPage.tsx
│       │   │   └── SplitConfigStepperPage.tsx
│       │   ├── types
│       │   │   ├── csvPreview.ts
│       │   │   ├── datasetRequest.ts
│       │   │   └── generation.ts
│       │   ├── App.css
│       │   ├── App.tsx
│       │   ├── index.css
│       │   └── main.tsx
│       ├── .gitignore
│       ├── README.md
│       ├── eslint.config.js
│       ├── index.html
│       ├── package-lock.json
│       ├── package.json
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
├── prompts
│   ├── domain_templates.py
│   └── teacher_template.py
├── tests
│   ├── core
│   │   ├── test_generate_dataset.py
│   │   ├── test_openrouter_sythesis.py
│   │   └── test_openrouter_sythesis_integration.py
│   └── utils
│       └── test_models.py
├── utils
│   ├── csv_selection.py
│   ├── exceptions.py
│   └── models.py
├── .gitignore
├── requirements.txt
├── run_test.py
├── server.py
└── setup.py
```
React Vite webapp providing the user interface for dataset generation and management. Contains components, pages, and utilities for the frontend application.
## Folder Overview

### **data**
Contains the persona_hub and datasets created by users. Store your generated datasets and persona configurations here.

### **frontend**
React Vite webapp providing the user interface for dataset generation and management. Contains components, pages, and utilities for the frontend application.

### **core**
Core functions for dataset generation. Includes the main logic for generating synthetic datasets using various AI models and templates.

### **utils**
Utility functions for server operations, database connections, and shared helper functions used across the application.

### **prompts**
Template files for domain-specific prompts and teacher templates used in dataset generation.

### **tests**
Unit and integration tests for core functionality and utilities.

