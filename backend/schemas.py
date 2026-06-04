import json
from typing import Any, Optional
from pydantic import BaseModel, Field, model_validator


class SessionUnwrapper(BaseModel):
    session_id: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _unwrap_payload(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        sid = data.get("session_id")
        if isinstance(sid, str) and sid.strip().startswith("{"):
            try:
                nested = json.loads(sid)
                if isinstance(nested, dict):
                    # Merge nested keys into the top-level dict
                    # This fixes cases where the LLM does:
                    # {"session_id": "{\"session_id\": \"...\", \"group_column\": \"...\"}"}
                    return {**nested, **data, "session_id": nested.get("session_id", sid)}
            except json.JSONDecodeError:
                pass
        return data


# --- Statistical tool schemas ---

class DescriptiveStatsInput(SessionUnwrapper):
    columns: Optional[list[str]] = None


class GroupByInput(SessionUnwrapper):
    group_column: Optional[str] = None
    agg_column: Optional[str] = None
    agg_func: str = Field(default="mean", pattern="^(mean|median|sum|min|max|count|std)$")


class CorrelationInput(SessionUnwrapper):
    columns: Optional[list[str]] = None


class ValueCountsInput(SessionUnwrapper):
    column: Optional[str] = None
    normalize: bool = False
    limit: int = Field(default=20, ge=1, le=200)


class OutliersInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    method: str = Field(default="iqr", pattern="^(iqr|zscore)$")
    threshold: float = 1.5


# --- ML tool schemas ---

class PCAInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    n_components: Optional[int] = Field(default=None, ge=2)


class ClusteringInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    n_clusters: int = Field(default=3, ge=2, le=20)


class RegressionInput(SessionUnwrapper):
    target_column: Optional[str] = None
    feature_columns: Optional[list[str]] = None
    test_size: float = Field(default=0.2, gt=0.0, lt=1.0)


class ClassificationInput(SessionUnwrapper):
    target_column: Optional[str] = None
    feature_columns: Optional[list[str]] = None
    test_size: float = Field(default=0.2, gt=0.0, lt=1.0)


class AnomalyDetectionInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    contamination: float = Field(default=0.05, gt=0.0, le=0.5)


# --- Time series tool schemas ---

class TimeSeriesInput(SessionUnwrapper):
    date_column: Optional[str] = None
    value_column: Optional[str] = None


class ForecastInput(SessionUnwrapper):
    date_column: Optional[str] = None
    value_column: Optional[str] = None
    steps: int = Field(default=12, ge=1)
    model: str = Field(default="arima", pattern="^(arima|prophet)$")


class StationarityInput(SessionUnwrapper):
    date_column: Optional[str] = None
    value_column: Optional[str] = None


# --- Dataset + chart tool schemas ---

class DescribeDatasetInput(SessionUnwrapper):
    pass


class UMAPInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    n_components: int = Field(default=2, ge=2, le=3)
    n_neighbors: int = Field(default=15, ge=2, le=200)
    min_dist: float = Field(default=0.1, ge=0.0, le=1.0)


class HDBSCANInput(SessionUnwrapper):
    columns: Optional[list[str]] = None
    min_cluster_size: int = Field(default=5, ge=2, le=100)
    min_samples: Optional[int] = None


class SHAPInput(SessionUnwrapper):
    target_column: Optional[str] = None
    feature_columns: Optional[list[str]] = None
    max_display: int = Field(default=10, ge=1, le=50)


class GenerateChartSpecInput(SessionUnwrapper):
    chart_type: Optional[str] = Field(default=None, description="One of: scatter, line, bar, histogram, heatmap, box")
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    color_column: Optional[str] = None
    title: Optional[str] = None


# --- API request / response models ---

class UploadResponse(BaseModel):
    session_id: str
    filename: str
    rows: int
    columns: int
    column_names: list[str]


class SessionInfo(BaseModel):
    session_id: str
    filename: str
    shape: list[int]  # [rows, columns]
    columns: list[str]
    dtypes: dict[str, str]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    chart_spec: Optional[dict[str, Any]] = None
    has_error: bool = False
    steps: list[dict[str, Any]] = []


# --- Auth schemas ---

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: str


class SessionHistoryItem(BaseModel):
    session_id: str
    filename: str
    shape: list[int]
    created_at: str
    expires_at: Optional[str] = None
