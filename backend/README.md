# CivilBlueprint AI - corrected local version

## Architecture
- React + Vite frontend
- FastAPI backend
- SQLite database
- Gemini Vision for blueprint analysis
- No Docker required

## 1. Backend setup (Windows PowerShell)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` from `.env.example` and add your own Gemini API key:

```env
GEMINI_API_KEY=YOUR_NEW_GEMINI_KEY
GEMINI_MOCK_MODE=false
```

If you only want to test the UI without using Gemini, temporarily set:

```env
GEMINI_MOCK_MODE=true
```

Start the API:

```powershell
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000
Swagger: http://127.0.0.1:8000/docs

## 2. Frontend setup

Open another PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Working flow

Register -> Login -> Create/select project -> Upload blueprint -> backend validates and preprocesses -> Gemini analyzes -> OCR + elements are saved to SQLite -> editor loads real elements -> edit -> Save.

## Important security note

Never commit `.env`, API keys, `venv`, `node_modules`, or database credentials. The distributed `.env` intentionally contains no API key.

If an API key was previously shared publicly or inside a ZIP, revoke it and create a replacement before using this project.
