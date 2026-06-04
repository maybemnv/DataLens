from typing import Optional
import asyncio
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report


async def perform_pca(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    n_components: Optional[int] = None,
) -> dict:
    """Run PCA dimensionality reduction — non-blocking via thread pool."""
    return await asyncio.to_thread(_perform_pca_sync, df, columns, n_components)


def _perform_pca_sync(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    n_components: Optional[int] = None,
) -> dict:
    cols = columns or df.select_dtypes(include="number").columns.tolist()
    if columns:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f"Column not found: {missing[0]!r}")
    if len(cols) < 2:
        raise ValueError("Need at least 2 numeric columns for PCA")

    data = df[cols].dropna()
    if len(data) < 2:
        raise ValueError("Not enough rows after dropping NaN")

    n = min(n_components or len(cols), len(data), len(cols))
    scaler = StandardScaler()
    scaled = scaler.fit_transform(data)

    pca = PCA(n_components=n)
    coords = pca.fit_transform(scaled)

    return {
        "explained_variance_pct": pca.explained_variance_ratio_.tolist(),
        "cumulative_variance_pct": np.cumsum(pca.explained_variance_ratio_).tolist(),
        "loadings": pd.DataFrame(
            pca.components_.T,
            index=cols,
            columns=[f"PC{i+1}" for i in range(n)],
        ).to_dict(),
        "coordinates": pd.DataFrame(
            coords,
            columns=[f"PC{i+1}" for i in range(n)],
        ).to_dict(orient="records"),
        "n_components": n,
        "columns": cols,
    }


async def perform_clustering(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    n_clusters: int = 3,
) -> dict:
    """K-means clustering — non-blocking via thread pool."""
    return await asyncio.to_thread(_perform_clustering_sync, df, columns, n_clusters)


def _perform_clustering_sync(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    n_clusters: int = 3,
) -> dict:
    cols = columns or df.select_dtypes(include="number").columns.tolist()
    if len(cols) < 2:
        raise ValueError("Need at least 2 numeric columns for clustering")

    data = df[cols].dropna()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(data)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(scaled)

    centers = pd.DataFrame(
        scaler.inverse_transform(kmeans.cluster_centers_),
        columns=cols,
    )

    from sklearn.metrics import silhouette_score
    silhouette = float(silhouette_score(scaled, labels))

    return {
        "labels": labels.tolist(),
        "cluster_centers": centers.to_dict(orient="records"),
        "inertia": float(kmeans.inertia_),
        "silhouette_score": silhouette,
        "n_clusters": n_clusters,
        "columns": cols,
    }


async def detect_anomalies(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    contamination: float = 0.05,
) -> dict:
    """Anomaly detection via Isolation Forest — non-blocking via thread pool."""
    return await asyncio.to_thread(_detect_anomalies_sync, df, columns, contamination)


def _detect_anomalies_sync(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    contamination: float = 0.05,
) -> dict:
    cols = columns or df.select_dtypes(include="number").columns.tolist()
    data = df[cols].dropna()

    iso = IsolationForest(contamination=contamination, random_state=42)
    predictions = iso.fit_predict(data)
    scores = iso.decision_function(data)

    anomaly_mask = predictions == -1
    anomaly_indices = data.index[anomaly_mask].tolist()

    return {
        "anomaly_count": int(anomaly_mask.sum()),
        "anomaly_pct": round(anomaly_mask.mean() * 100, 2),
        "anomaly_indices": anomaly_indices,
        "scores": scores.tolist(),
        "columns": cols,
    }


async def train_regression_model(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]] = None,
    test_size: float = 0.2,
) -> dict:
    """Random Forest regression — non-blocking via thread pool."""
    return await asyncio.to_thread(
        _train_regression_sync, df, target_column, feature_columns, test_size
    )


def _train_regression_sync(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]] = None,
    test_size: float = 0.2,
) -> dict:
    if target_column not in df.columns:
        raise ValueError(f"Target column not found: {target_column!r}")

    num_cols = df.select_dtypes(include="number").columns.tolist()
    features = feature_columns or [c for c in num_cols if c != target_column]

    missing = [c for c in features if c not in df.columns]
    if missing:
        raise ValueError(f"Feature column not found: {missing[0]!r}")

    if not features:
        raise ValueError("No feature columns available")

    data = df[features + [target_column]].dropna()
    X, y = data[features], data[target_column]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    return {
        "r2": round(float(r2_score(y_test, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
        "feature_importance": dict(
            zip(features, model.feature_importances_.round(4).tolist())
        ),
        "predictions_vs_actual": [
            {"actual": float(a), "predicted": float(p)}
            for a, p in zip(y_test, y_pred)
        ],
        "target_column": target_column,
        "feature_columns": features,
        "train_size": len(X_train),
        "test_size": len(X_test),
    }


async def train_classification_model(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]] = None,
    test_size: float = 0.2,
) -> dict:
    """Random Forest classification — non-blocking via thread pool."""
    return await asyncio.to_thread(
        _train_classification_sync, df, target_column, feature_columns, test_size
    )


def _train_classification_sync(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]] = None,
    test_size: float = 0.2,
) -> dict:
    if target_column not in df.columns:
        raise ValueError(f"Target column not found: {target_column!r}")

    num_cols = df.select_dtypes(include="number").columns.tolist()
    features = feature_columns or [c for c in num_cols if c != target_column]
    if not features:
        raise ValueError("No feature columns available")

    data = df[features + [target_column]].dropna()
    X, y = data[features], data[target_column]
    unique_classes = np.unique(y)
    stratify = y if len(unique_classes) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    return {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        "feature_importance": dict(
            zip(features, model.feature_importances_.round(4).tolist())
        ),
        "target_column": target_column,
        "feature_columns": features,
        "classes": unique_classes.tolist(),
    }


# ─── UMAP ────────────────────────────────────────────────────────────


async def perform_umap(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    n_components: int = 2,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
) -> dict:
    """UMAP dimensionality reduction — non-blocking via thread pool."""
    return await asyncio.to_thread(
        _perform_umap_sync, df, columns, n_components, n_neighbors, min_dist
    )


def _perform_umap_sync(
    df: pd.DataFrame,
    columns: Optional[list[str]],
    n_components: int,
    n_neighbors: int,
    min_dist: float,
) -> dict:
    cols = columns or df.select_dtypes(include="number").columns.tolist()
    if len(cols) < 2:
        raise ValueError("Need at least 2 numeric columns for UMAP")
    if columns:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f"Column not found: {missing[0]!r}")

    data = df[cols].dropna()
    if len(data) < n_neighbors + 1:
        raise ValueError(f"Not enough rows (need > {n_neighbors} neighbors)")

    scaler = StandardScaler()
    scaled = scaler.fit_transform(data)

    import umap

    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=42,
    )
    embedding = reducer.fit_transform(scaled)

    return {
        "embedding": embedding.tolist(),
        "n_components": n_components,
        "n_neighbors": n_neighbors,
        "min_dist": min_dist,
        "columns": cols,
        "shape": [len(embedding), n_components],
    }


# ─── HDBSCAN ─────────────────────────────────────────────────────────


async def perform_hdbscan(
    df: pd.DataFrame,
    columns: Optional[list[str]] = None,
    min_cluster_size: int = 5,
    min_samples: Optional[int] = None,
) -> dict:
    """HDBSCAN clustering — non-blocking via thread pool."""
    return await asyncio.to_thread(
        _perform_hdbscan_sync, df, columns, min_cluster_size, min_samples
    )


def _perform_hdbscan_sync(
    df: pd.DataFrame,
    columns: Optional[list[str]],
    min_cluster_size: int,
    min_samples: Optional[int],
) -> dict:
    cols = columns or df.select_dtypes(include="number").columns.tolist()
    if len(cols) < 2:
        raise ValueError("Need at least 2 numeric columns for HDBSCAN")

    data = df[cols].dropna()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(data)

    import hdbscan

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        gen_min_span_tree=True,
    )
    labels = clusterer.fit_predict(scaled)
    probs = clusterer.probabilities_
    n_clusters = len(set(labels) - {-1})
    n_noise = int((labels == -1).sum())

    return {
        "labels": labels.tolist(),
        "probabilities": probs.tolist(),
        "n_clusters": n_clusters,
        "n_noise_points": n_noise,
        "noise_pct": round(n_noise / len(labels) * 100, 2) if len(labels) > 0 else 0,
        "min_cluster_size": min_cluster_size,
        "columns": cols,
    }


# ─── SHAP ─────────────────────────────────────────────────────────────


async def perform_shap(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]] = None,
    max_display: int = 10,
) -> dict:
    """SHAP feature importance — non-blocking via thread pool."""
    return await asyncio.to_thread(
        _perform_shap_sync, df, target_column, feature_columns, max_display
    )


def _perform_shap_sync(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[list[str]],
    max_display: int,
) -> dict:
    if target_column not in df.columns:
        raise ValueError(f"Target column not found: {target_column!r}")

    num_cols = df.select_dtypes(include="number").columns.tolist()
    features = feature_columns or [c for c in num_cols if c != target_column]
    if not features:
        raise ValueError("No feature columns available")

    data = df[features + [target_column]].dropna()
    X, y = data[features], data[target_column]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    unique_targets = np.unique(y_train)
    is_classification = y_train.dtype.name == "category" or (
        y_train.dtype.kind in ("i", "u", "O", "b")
        and 2 <= len(unique_targets) < 20
    )

    if is_classification:
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        accuracy = float(accuracy_score(y_test, model.predict(X_test)))
        metric = {"accuracy": round(accuracy, 4)}
    else:
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        r2 = float(r2_score(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        metric = {"r2": round(r2, 4), "rmse": round(rmse, 4)}

    import shap

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    # shap 0.46+ returns 3D ndarray (samples, features, classes) for multi-class
    if isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
        shap_values = shap_values[:, :, 1] if shap_values.shape[2] > 1 else shap_values[:, :, 0]
    elif isinstance(shap_values, list):
        shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]

    expected = explainer.expected_value
    if isinstance(expected, np.ndarray):
        base_value = float(expected[1]) if expected.ndim > 0 and len(expected) > 1 else float(expected[0])
    elif isinstance(expected, list):
        base_value = float(expected[1]) if len(expected) > 1 else float(expected[0])
    else:
        base_value = float(expected)

    # mean_abs_shap is now 1D (n_features,)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    feature_ranking = sorted(
        zip(features, mean_abs_shap), key=lambda x: float(abs(x[1])), reverse=True
    )

    top_features = feature_ranking[:max_display]
    chart_spec = {
        "type": "bar",
        "title": f"SHAP Feature Importance — {target_column}",
        "x_label": "mean(|SHAP value|)",
        "y_label": "Feature",
        "data": [
            {"feature": feat, "importance": round(float(val), 4)}
            for feat, val in top_features
        ],
    }

    return {
        "base_value": base_value,
        "feature_importance": {
            feat: round(float(val), 4) for feat, val in feature_ranking
        },
        "top_features": [feat for feat, _ in top_features],
        "chart_spec": chart_spec,
        "target_column": target_column,
        "feature_columns": features,
        "model_type": "classification" if is_classification else "regression",
        "model_metrics": metric,
    }
