from typing import Optional
from abc import ABC, abstractmethod
from google import genai
import logging
import json
from pydantic import BaseModel

class TranscriptItem(BaseModel):
    query: str
    response: str


class LLM(ABC):
    def __init__(self, model_name: Optional[str]):
        self.model_name = model_name
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_model_name(self) -> str:
        return self.model_name

    @abstractmethod
    def generate_response(self, prompt: str, audio_path: Optional[str]) -> str:
        pass


class GeminiLLM(LLM):
    def __init__(self, model_name: Optional[str] = None):
        super().__init__(model_name or "gemini-2.0-flash")
        self.client = genai.Client()
        self.logger = logging.getLogger(self.__class__.__name__)
        # Could vary based on the model/provider. Keeping it here for now
        self.prompt_prefix = "Briefly respond to query in the audio or text. Use the following schema: {'query': <the query verbatim>, 'response': <your response>}"

    def generate_response(self, prompt: str, audio_path: Optional[str]) -> str:
        try:
            audio_file = ""
            if audio_path:
                audio_file = self.client.files.upload(file=audio_path)
                self.logger.debug("Uploaded audio file: %s", audio_file)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[(self.prompt_prefix + prompt), audio_file],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": TranscriptItem,
                },
            )

            jsonresp = json.loads(response.text)
            return jsonresp
        except Exception as e:
            self.logger.error("Error in generate_response: %s", str(e))
            return f"An error occurred while processing your request: {str(e)}"

    def get_llm(self):
        return self
