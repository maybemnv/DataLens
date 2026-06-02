# DataLens AI

An autonomous data analysis platform powered by a LangChain ReAct agent (Groq LLM). Upload a structured dataset and ask questions in plain English — the agent selects and chains the appropriate analytical tools, returns precise results, and can render Vega-Lite chart specifications for the frontend.

## Architecture


```mermaid
graph TD
    Client[Frontend<br/>Next.js] <-->|HTTP / WebSocket| API[Backend<br/>FastAPI]
    API <--> External[External Services<br/>Google Gemini<br/>PostgreSQL<br/>Redis]
    
    subgraph Frontend Features
        Client -.-> UI[React UI]
        Client -.-> Vega[Vega-Lite]
        Client -.-> WS[WebSocket]
    end
    
    subgraph Backend Features
        API -.-> Agent[ReAct Agent]
        API -.-> Registry[Tool Registry]
        API -.-> Parser[File Parser]
    end
    
    Browser[User Browser<br/>- Upload files<br/>- View charts<br/>- Chat UI] -->|Interacts with| Client
    
    API --> DB[(Database)]
    DB -.-> Msgs[Messages]
    DB -.-> Sess[Sessions]
    DB -.-> Chts[Charts]
    DB -.-> Runs[Tool Runs]
```

## Requirements

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) package manager
- PostgreSQL 15+
- Redis (local) or Upstash Redis (cloud)
- Groq API key
- Node.js 20+ (for frontend)

## Setup

### Backend

```bash
# Create and activate virtual environment
cd backend
uv venv
.venv\Scripts\Activate   # Windows
source .venv/bin/activate # Unix

# Install dependencies
uv sync
```

Create a `.env` file in the project root:

```env
# Required
GROQ_API_KEY=your_api_key_here
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Optional (with defaults)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=datalens
MAX_UPLOAD_MB=100
SESSION_TTL_SECONDS=3600
ENVIRONMENT=development
LOG_LEVEL=INFO

# Redis (choose one)
REDIS_URL=redis://127.0.0.1:6379/0
# OR for Upstash:
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### Frontend

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Running

### Development

```bash
# Terminal 1: Backend
uv run uvicorn backend.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

The API will be at `http://127.0.0.1:8000`. Frontend at `http://localhost:3000`.
Interactive API docs at `/docs`.

### Docker

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yaml up
```

## API Reference

### Upload

**POST /upload**
```
Content-Type: multipart/form-data
file: <CSV | XLSX | XLS | Parquet>
```

**GET /sessions/{session_id}**
Returns dataset metadata (shape, columns, dtypes, missing values).

**DELETE /sessions/{session_id}**
Delete a session and its data.

**GET /sessions**
List all active session IDs.

### Chat

**POST /chat/{session_id}**
```json
{ "message": "What are the top spending categories?" }
```

Response:
```json
{
  "answer": "string",
  "chart_spec": { /* Vega-Lite spec */ },
  "has_error": false,
  "steps": [{ "tool": "...", "args": {}, "result": {} }]
}
```

**WS /ws/{session_id}**
Streaming WebSocket endpoint. Sends events:
- `thought` — Agent reasoning
- `tool_call` — Tool execution start
- `tool_result` — Tool execution complete
- `chart` — Vega-Lite chart specification
- `answer` — Final response
- `error` — Error message
- `done` — Stream complete

Message format:
```json
{ "message": "your question here" }
```

### Chat History

**GET /chat/{session_id}/messages**
Returns conversation history with tool runs.

**GET /chat/{session_id}/charts**
Returns all charts generated in the session.

### Health

**GET /health**
```json
{ "status": "ok", "version": "2.0.0" }
```

**GET /**
Root endpoint with API overview.

## Supported File Types

| Format  | Extension       |
| ------- | --------------- |
| CSV     | `.csv`          |
| Excel   | `.xlsx`, `.xls` |
| Parquet | `.parquet`      |

Maximum upload size is configurable via `MAX_UPLOAD_MB` (default: 100 MB).

## Agent Tools

| Tool                    | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `describe_dataset`      | Schema, dtypes, null counts, sample rows, numeric summary               |
| `generate_chart_spec`   | Vega-Lite v5 specification for scatter, line, bar, histogram, box plots |
| `descriptive_stats`     | Mean, std, min, max, skew, kurtosis per column                          |
| `group_by_stats`        | Aggregation (mean / sum / count / etc.) grouped by a categorical column |
| `correlation_matrix`    | Pearson correlation matrix                                              |
| `value_counts`          | Top-N most frequent values in a column                                  |
| `outliers_summary`      | Outlier detection via IQR or Z-score                                    |
| `run_pca`               | PCA with explained variance and 2D/3D projection coordinates            |
| `run_kmeans`            | K-means clustering with silhouette score                                |
| `detect_anomalies`      | Isolation Forest anomaly detection                                      |
| `run_regression`        | Random Forest regression — R², RMSE, feature importance                 |
| `run_classification`    | Random Forest classification — accuracy, per-class metrics              |
| `check_stationarity`    | ADF + KPSS stationarity tests                                           |
| `run_forecast`          | ARIMA or Prophet forecast with confidence intervals                     |
| `decompose_time_series` | Trend / seasonal / residual decomposition                               |

## Running Tests

Create a `.env` file with a valid API key (required for test imports):

```env
GROQ_API_KEY=your_api_key_here
DB_USER=test_user
DB_PASSWORD=test_password
```

### Run All Tests

```bash
uv run pytest
```

### Run Specific Test Suites

| Command | Description |
| ------- | ----------- |
| `uv run pytest tests/backend/test_api.py -v` | API endpoints (upload, sessions, health) |
| `uv run pytest tests/backend/test_statistical.py -v` | Statistical analysis functions |
| `uv run pytest tests/backend/test_ml.py -v` | ML tools (PCA, clustering, regression, classification) |
| `uv run pytest tests/backend/test_time_series.py -v` | Time series (stationarity, forecasting, decomposition) |
| `uv run pytest tests/backend/test_benchmarks.py -v` | 30 benchmark queries + output parser |

### Run with Verbose Output

```bash
uv run pytest -v                    # Show all test names
uv run pytest -v --tb=short         # Verbose with short traceback
uv run pytest --cov=backend         # With coverage (requires pytest-cov)
```

### Test Coverage Summary

| Suite | Tests | Description |
| ----- | ----- | ----------- |
| `test_api.py` | 6 | FastAPI endpoints, file upload, session management |
| `test_statistical.py` | 11 | Descriptive stats, correlations, outliers, value counts |
| `test_ml.py` | 8 | PCA, K-means, anomaly detection, regression, classification |
| `test_time_series.py` | 10 | ADF/KPSS tests, ARIMA/Prophet forecasting, decomposition |
| `test_benchmarks.py` | 35 | Query-to-tool mapping validation, output parser |
| **Total** | **70** | All backend tests |

## License

[MIT](./LICENSE)
