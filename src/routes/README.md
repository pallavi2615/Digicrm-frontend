# Routes

This folder contains the application's page components. `src/router.tsx` registers them with React Router, and `src/lib/router-compat.tsx` adapts the existing route declarations and navigation calls to React Router while keeping page components unchanged.

Use `src/lib/api.ts` for Axios-backed requests to the FastAPI backend.
