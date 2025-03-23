from constants import voice_embedding

config = {
    "tts_chunking_limit": 15,
    "voice_embedding": voice_embedding,
    "model_id": "sonic-2",
    # cartesia output, will create a separate tts class
    # "container": "raw",
    # "encoding": "pcm_f32le",
    # "sample_rate": 22050
}