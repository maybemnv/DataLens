"""Debug: find where max_retries is stored on the agent."""
import os
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")

from backend.agent.analyst_agent import _get_or_create_executor
from langchain_groq import ChatGroq

executor = _get_or_create_executor("debug-session")
agent = executor.agent

print("Agent type:", type(agent).__name__)

# Check the runnable chain for the ChatGroq instance
print("\nLooking for ChatGroq instance in runnable tree:")
def walk(obj, depth=0, max_depth=6, path="agent"):
    if depth > max_depth:
        return
    if isinstance(obj, ChatGroq):
        print(f"  Found ChatGroq at {path}: max_retries={obj.max_retries}")
    for attr_name in dir(obj):
        if attr_name.startswith("_"):
            continue
        try:
            attr = getattr(obj, attr_name)
            if not callable(attr) and attr is not None:
                walk(attr, depth + 1, max_depth, f"{path}.{attr_name}")
        except Exception:
            pass

walk(agent)
