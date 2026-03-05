# Final Project Frontend

React + TypeScript frontend for dataset generation and management application.

## Components

### CSV Display Components
- **CSV Preview System**: Located in `src/components/csv-preview/`
  - Supports pagination, sorting, filtering, and search
  - Handles both range-based and filter-based data fetching
  - Types defined in `src/types/csvPreview.ts`

### Dataset Generation Components
- Located in `src/components/generate-datasets/`
  - Form components for dataset configuration
  - Model selection and parameter configuration
  - Progress tracking and error handling

## Types and Backend Integration

### Core Type Definitions
- **CSV Operations**: `src/types/csvPreview.ts`
  - `CsvPreviewQuery`, `CsvPreviewResult`, `CsvDataSource`
  - Sorting, filtering, and pagination interfaces

- **Dataset Requests**: `src/types/datasetRequest.ts`
  - `DatasetGenerationConfigPayload`, `PersonaSplitsChoicesPayload`
  - Model configuration and job status types

- **Generation**: `src/types/generation.ts`
  - Reasoning effort and summary types

### Backend API Integration
- **API Client**: `src/lib/api.ts`
  - All backend service calls and HTTP requests
  - Dataset generation, CSV preview, and model management endpoints

- **Model Configuration**: `src/lib/openrouterModels.ts`, `src/lib/providerEndpoints.ts`
  - Available models and provider configurations


### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Tech Stack
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- ESLint for code quality
