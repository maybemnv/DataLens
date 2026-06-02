# Agent Behavior

Documentation on how the DataLens AI agent reasons, selects tools, and generates responses.

## Overview

The agent is built on a **ReAct (Reasoning + Acting)** architecture using:
- **LLM**: Groq (qwen/qwen3-32b)
- **Framework**: LangChain with custom tools
- **Strategy**: Chain-of-thought reasoning with tool orchestration

## ReAct Pattern

The agent follows a loop of **Thought → Action → Observation**:

```
User Query: "What's the correlation between sales and marketing spend?"

Thought: The user wants to understand the relationship between two 
        numeric columns. I should:
        1. First check what columns exist in the dataset
        2. Find the correlation between relevant columns
        3. Generate a visualization if appropriate

Action: describe_dataset
Input: {}

Observation: { columns: ["date", "sales", "marketing_spend", 
          "region", ...], dtypes: {...} }

Thought: I can see 'sales' and 'marketing_spend' are numeric columns.
        I'll calculate the correlation matrix and generate a scatter plot.

Action: correlation_matrix
Input: { "columns": ["sales", "marketing_spend"] }

Observation: { "sales": {"sales": 1.0, "marketing_spend": 0.87}, 
               "marketing_spend": {"sales": 0.87, "marketing_spend": 1.0} }

Thought: There's a strong positive correlation (0.87). I'll create
        a scatter plot to visualize this relationship.

Action: generate_chart_spec
Input: { "chart_type": "scatter", "x_column": "marketing_spend", 
         "y_column": "sales", "title": "Sales vs Marketing Spend" }

Observation: { /* Vega-Lite spec */ }

Thought: I have all the information needed to answer.

Final Answer: There is a strong positive correlation (r = 0.87) between
sales and marketing spend. The scatter plot shows that as marketing 
investment increases, sales tend to increase proportionally.
```

## System Prompt

The agent uses a carefully engineered system prompt:

```
You are a data analysis assistant. Analyze datasets and answer questions.

Available tools:
{tool_descriptions}

Use this format:
Thought: [your reasoning about what to do next]
Action: [tool name]
Action Input: [JSON input for the tool]
Observation: [tool result - provided by system]
... (repeat Thought/Action/Observation as needed)
Thought: [final reasoning]
Final Answer: [response to user with key insights]

Guidelines:
- Always check the dataset schema first with describe_dataset
- Choose the most appropriate tool for each step
- Generate charts when visualizations would help
- Be concise but thorough in explanations
- If data is insufficient, say so clearly
```

## Tool Selection Logic

### Decision Tree

```
User Query
    │
    ├──► Contains "describe", "schema", "columns", "what's in"?
    │    └──► describe_dataset
    │
    ├──► Contains "average", "mean", "std", "statistics", "summary"?
    │    └──► descriptive_stats
    │
    ├──► Contains "group by", "category", "by department", "per region"?
    │    └──► group_by_stats
    │
    ├──► Contains "correlation", "relationship", "correlated"?
    │    └──► correlation_matrix
    │
    ├──► Contains "outliers", "anomalies", "unusual values"?
    │    └──► outliers_summary
    │
    ├──► Contains "PCA", "components", "dimensionality"?
    │    └──► run_pca
    │
    ├──► Contains "cluster", "groups", "segments"?
    │    └──► run_kmeans
    │
    ├──► Contains "predict", "forecast", "future"?
    │    └──► run_forecast
    │
    ├──► Contains "chart", "plot", "graph", "visualization"?
    │    └──► generate_chart_spec (+ prior analysis tool)
    │
    └──► Default: describe_dataset → analyze → answer
```

### Multi-Tool Chaining

Complex queries require multiple tools in sequence:

| Query Type | Tool Chain |
|------------|------------|
| "Show spending trends by department" | describe_dataset → group_by_stats → generate_chart_spec |
| "Detect anomalies in sales data" | describe_dataset → detect_anomalies → generate_chart_spec |
| "Predict next quarter sales" | describe_dataset → check_stationarity → run_forecast → generate_chart_spec |
| "Cluster customers" | describe_dataset → run_kmeans → generate_chart_spec |
| "What's driving revenue?" | describe_dataset → correlation_matrix → run_regression → generate_chart_spec |

## Output Format

The agent produces structured output via the output parser:

```python
{
    "answer": "Natural language response",
    "chart_spec": {  # Optional Vega-Lite spec
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "bar",
        "encoding": {...}
    },
    "has_error": False,
    "intermediate_steps": [
        (tool_action, observation),
        ...
    ]
}
```

## Prompt Engineering Techniques

### 1. Few-Shot Examples

The prompt includes examples of correct tool usage:

```
Example 1:
User: "What's the average price?"
Thought: The user wants a simple statistic. I need to check if 'price' 
        exists and calculate its mean.
Action: descriptive_stats
Action Input: {"columns": ["price"]}
...
```

### 2. Output Constraints

```
When generating Final Answer:
- Start with a direct answer to the question
- Include specific numbers from the data
- Explain methodology if non-obvious
- Suggest follow-up analyses when relevant
- Keep responses under 200 words unless necessary
```

### 3. Chart Generation Triggers

The agent generates charts when:
- User explicitly requests visualization
- Data has 3+ data points for comparison
- Time-series data is present
- Geographic or categorical breakdown exists
- Correlation analysis is performed

### 4. Error Recovery

If a tool fails:
```
Observation: { "error": "Column 'revenue' not found" }

Thought: The column name is incorrect. Let me check the actual 
        column names first.

Action: describe_dataset
Action Input: {}

Observation: { columns: ["sales", "costs", "profit"] }

Thought: The user probably meant 'sales'. I'll use that instead.
...
```

## Context Management

### Conversation History

Last 10 messages are included in context:

```python
context = """
Previous conversation:
User: What are the top products?
Assistant: The top 3 products are A ($50K), B ($45K), C ($40K).

User: {current_query}
"""
```

### Session Schema

Dataset metadata is always available:

```python
session_context = {
    "filename": "sales_data.csv",
    "shape": [10000, 15],
    "columns": ["date", "product", "region", "sales", ...],
    "dtypes": {...},
    "numeric_columns": ["sales", "quantity", "price"],
    "categorical_columns": ["product", "region"]
}
```

## Tool Input Generation

### Automatic Column Detection

The agent infers column names from context:

| User Query | Inferred Columns |
|------------|------------------|
| "Sales by region" | group_column="region", agg_column="sales" |
| "Price trends" | value_column="price" (time series) |
| "Top products" | group_column="product", agg_column auto-selected |

### Parameter Defaults

When parameters are ambiguous, defaults are used:

```python
# group_by_stats defaults
{
    "agg_func": "sum"  # for currency, "mean" for rates, "count" for IDs
}

# outliers defaults  
{
    "method": "iqr"  # vs "zscore" for normal distributions
}

# forecast defaults
{
    "model": "arima",  # vs "prophet" for seasonality
    "steps": 12       # forecast horizon
}
```

## Performance Characteristics

| Metric | Typical Value |
|--------|---------------|
| Tool selection latency | 500-1500ms |
| Tool execution time | 100ms - 5s (depends on data size) |
| Total response time | 2-10 seconds |
| Max tools per query | 5 (configurable) |
| Context window | 10 messages + session schema |

## Testing Agent Behavior

### Benchmark Queries

See `tests/backend/test_benchmarks.py` for validation:

```python
TEST_QUERIES = [
    ("What's the average of column X?", "descriptive_stats"),
    ("Show me outliers", "outliers_summary"),
    ("Predict future values", "run_forecast"),
    ("Group by category", "group_by_stats"),
]
```

### Evaluating Output Quality

Good responses have:
- [ ] Direct answer to the question
- [ ] Specific numbers cited
- [ ] Appropriate tool selection
- [ ] Chart when visualization helps
- [ ] Correct column inference
- [ ] Error handling if data missing

## Tuning Tips

To improve agent performance:

1. **Add more few-shot examples** for common query patterns
2. **Adjust max_iterations** if agent needs more steps
3. **Customize tool descriptions** for domain-specific data
4. **Add retry logic** for transient LLM failures
5. **Implement caching** for repeated similar queries
