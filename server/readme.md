### Starting the local server

uv venv
source .venv/bin/activate
uv sync

uvicorn main:app --reload

### TODO:

- [x] Connection and TTS classes
- [ ] OAI integration - realtime to text
- [ ] Scripting, agenda endpoint
- [ ] Logging, analytics