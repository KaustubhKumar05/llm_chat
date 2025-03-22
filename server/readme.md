### Starting the local server

uv venv
source .venv/bin/activate
uv sync

uvicorn main:app --reload