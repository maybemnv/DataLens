from typing import Optional
from langchain_core.tools import tool
from ..schemas import PCAInput, ClusteringInput, RegressionInput, ClassificationInput, AnomalyDetectionInput, UMAPInput, HDBSCANInput, SHAPInput
from ..analyzers import ml
from .guards import require_df


@tool("run_pca", args_schema=PCAInput)
async def run_pca(session_id: Optional[str] = None, columns: list[str] | None = None, n_components: int | None = None) -> dict:
    """Run PCA dimensionality reduction. Returns component loadings, explained variance, and 2D/3D coordinates."""
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.perform_pca(df, columns=columns, n_components=n_components)
    except ValueError as e:
        return {"error": str(e)}


@tool("run_kmeans", args_schema=ClusteringInput)
async def run_kmeans(session_id: Optional[str] = None, columns: list[str] | None = None, n_clusters: int = 3) -> dict:
    """Cluster data into K groups using K-means. Returns labels, centroids, and silhouette score."""
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.perform_clustering(df, columns=columns, n_clusters=n_clusters)
    except ValueError as e:
        return {"error": str(e)}


@tool("detect_anomalies", args_schema=AnomalyDetectionInput)
async def detect_anomalies(session_id: Optional[str] = None, columns: list[str] | None = None, contamination: float = 0.05) -> dict:
    """Detect anomalous rows using Isolation Forest. Returns anomaly indices and scores."""
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.detect_anomalies(df, columns=columns, contamination=contamination)
    except Exception as e:
        return {"error": str(e)}


@tool("run_regression", args_schema=RegressionInput)
async def run_regression(
    session_id: Optional[str] = None,
    target_column: Optional[str] = None,
    feature_columns: list[str] | None = None,
    test_size: float = 0.2,
) -> dict:
    """Train a Random Forest regression model. Returns R², RMSE, and feature importance."""
    if not target_column:
        return {"error": "target_column is required"}

    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.train_regression_model(df, target_column, feature_columns=feature_columns, test_size=test_size)
    except ValueError as e:
        return {"error": str(e)}


@tool("run_classification", args_schema=ClassificationInput)
async def run_classification(
    session_id: Optional[str] = None,
    target_column: Optional[str] = None,
    feature_columns: list[str] | None = None,
    test_size: float = 0.2,
) -> dict:
    """Train a Random Forest classification model. Returns accuracy and per-class metrics."""
    if not target_column:
        return {"error": "target_column is required"}

    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.train_classification_model(df, target_column, feature_columns=feature_columns, test_size=test_size)
    except ValueError as e:
        return {"error": str(e)}


@tool("run_umap", args_schema=UMAPInput)
async def run_umap(
    session_id: Optional[str] = None,
    columns: list[str] | None = None,
    n_components: int = 2,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
) -> dict:
    """Run UMAP dimensionality reduction. Preserves local structure better than PCA. Returns 2D/3D embeddings for visualization."""
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.perform_umap(df, columns=columns, n_components=n_components, n_neighbors=n_neighbors, min_dist=min_dist)
    except ValueError as e:
        return {"error": str(e)}
    except ImportError:
        return {"error": "umap-learn is not installed. Run `uv add umap-learn`."}


@tool("run_hdbscan", args_schema=HDBSCANInput)
async def run_hdbscan(
    session_id: Optional[str] = None,
    columns: list[str] | None = None,
    min_cluster_size: int = 5,
    min_samples: int | None = None,
) -> dict:
    """Cluster data using HDBSCAN. Does not require a fixed K; automatically detects clusters and identifies noise points."""
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.perform_hdbscan(df, columns=columns, min_cluster_size=min_cluster_size, min_samples=min_samples)
    except ValueError as e:
        return {"error": str(e)}
    except ImportError:
        return {"error": "hdbscan is not installed. Run `uv add hdbscan`."}


@tool("run_shap", args_schema=SHAPInput)
async def run_shap(
    session_id: Optional[str] = None,
    target_column: Optional[str] = None,
    feature_columns: list[str] | None = None,
    max_display: int = 10,
) -> dict:
    """Run SHAP to explain model predictions. Returns SHAP values per feature and a chart spec. Use after regression or classification."""
    if not target_column:
        return {"error": "target_column is required"}
    df, err = await require_df(session_id)
    if err:
        return err
    try:
        return await ml.perform_shap(df, target_column=target_column, feature_columns=feature_columns, max_display=max_display)
    except ValueError as e:
        return {"error": str(e)}
    except KeyError as e:
        return {"error": f"Column not found: {e}"}
    except ImportError:
        return {"error": "shap is not installed. Run `uv add shap`."}
