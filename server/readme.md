### Starting the local server

uv venv
source .venv/bin/activate
uv sync

uvicorn main:app --reload

### TODO:

- [ ] Connection and TTS classes
- [ ] OAI integration
- [ ] Scripting, agenda endpoint
- [ ] Phone support? 