### Starting the local server

uv venv
source .venv/bin/activate
uv sync

uvicorn main:app --reload

### TODO:

- [x] Connection and TTS classes
- [x] Gemini integration - realtime to text
- [ ] Transcripts
- [ ] Scripting, agenda endpoint
- [ ] Logging, analytics