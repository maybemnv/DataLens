# Agent Behavior

How the DataLens AI ReAct agent reasons, selects tools, and streams responses.

## Overview

- **LLM**: Groq (`qwen/qwen3-32b`) via `langchain-groq`
- **Framework**: LangChain `create_react_agent` with 17 custom tools
- **Strategy**: ReAct loop with chain-of-thought, streaming via WebSocket
- **Caching**: Executor cached per session (10min TTL), rate-limited to 3 concurrent runs

## ReAct Loop

```
Thought:   → Typewriter animation, avatar pulses (purple)
Action:    → Tool card builds itself (arguments populate one by one)
Observ.:   → Result snaps in with scale animation
Thought:   → Avatar shifts color
Final:     → Structured answer + Vega-Lite chart spec
```

## Tool Registry (17)

| Category | Tools |
|----------|-------|
| Dataset | `describe_dataset`, `generate_chart_spec` |
| Statistical | `descriptive_stats`, `group_by_stats`, `correlation_matrix`, `value_counts`, `outliers_summary` |
| ML | `run_pca`, `run_kmeans`, `detect_anomalies`, `run_regression`, `run_classification`, `run_umap`, `run_hdbscan`, `run_shap` |
| Time Series | `check_stationarity`, `run_forecast`, `decompose_time_series` |

## Tool Selection Logic

| User intent | Chain |
|-------------|-------|
| "describe the data" | `describe_dataset` |
| "average/statistics" | `describe_dataset` → `descriptive_stats` |
| "group by category" | `describe_dataset` → `group_by_stats` |
| "correlation" | `describe_dataset` → `correlation_matrix` → `generate_chart_spec` |
| "outliers/anomalies" | `describe_dataset` → `detect_anomalies` → `generate_chart_spec` |
| "cluster/segment" | `describe_dataset` → `run_pca` → `run_kmeans` → `run_umap` → `generate_chart_spec` |
| "predict/forecast" | `describe_dataset` → `check_stationarity` → `run_forecast` → `generate_chart_spec` |
| "what affects X" | `describe_dataset` → `correlation_matrix` → `run_regression` → `run_shap` → `generate_chart_spec` |
| "visualize/chart" | `<analysis tool>` → `generate_chart_spec` |

## Error Recovery

The agent uses retries with exponential backoff on tool failures. If a column is not found, it re-calls `describe_dataset` to recover correct names.

## Context Management

Last 10 messages + full dataset schema injected into system prompt per query.
