from typing import Optional
from abc import ABC, abstractmethod
from google import genai
import logging
import json
from pydantic import BaseModel


class TranscriptItem(BaseModel):
    query: str
    response: str
    context: str


class LLM(ABC):
    def __init__(self, model_name: Optional[str]):
        self.model_name = model_name
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_model_name(self) -> str:
        return self.model_name

    @abstractmethod
    def generate_response(
        self, uuid: str, prompt: str, audio_path: Optional[str]
    ) -> str:
        pass


class GeminiLLM(LLM):
    def __init__(self, model_name: Optional[str] = None):
        super().__init__(model_name or "gemini-2.0-flash")
        self.client = genai.Client()
        self.logger = logging.getLogger(self.__class__.__name__)
        # Could vary based on the model/provider. Keeping it here for now
        self.prompt_prefix = "Cheerfully respond to query in the audio or text. Keep the context in mind as the user might refer back to it and keep updating it as the conversation proceeds. Use the following schema: {'query': <the query verbatim>, 'response': <your response>, 'context': <only the summary of the current query and response>}. This is the query:"
        self.context = dict()
        self.last_response = dict()

    def generate_response(
        self, uuid: str, prompt: str, audio_path: Optional[str]
    ) -> dict:
        try:
            audio_file = ""
            if audio_path:
                audio_file = self.client.files.upload(file=audio_path)
                self.logger.debug("Uploaded audio file: %s", audio_file)

            # Initialize context and last_response for new UUIDs
            if uuid not in self.context:
                self.context[uuid] = ""
            if uuid not in self.last_response:
                self.last_response[uuid] = ""

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    (self.prompt_prefix + prompt),
                    audio_file,
                    "Last AI response: " + self.last_response[uuid],
                    "Context: " + self.context[uuid],
                ],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": TranscriptItem,
                    "system_instruction": "You will be provided a text or audio prompt with some context and a last response so you remember the flow of the conversation. The prompts contain queries which you should respond to. The queries might refer to something in the context but not necessarily. Always return a summary as context of the current exchange only, not the past ones. Your response will be fed to a TTS engine so avoid asterisks and similar special characters. Make sure the context is succint while not losing any details. Feel free to include emojis and write in paragraphs if the answer is too long to make things more readable and user friendly",
                },
            )

            jsonresp = json.loads(response.text)
            self.context[uuid] += jsonresp["context"]
            self.last_response[uuid] = jsonresp["response"]
            print(f"\nContext: {self.context[uuid]} \n")

            return jsonresp
        except Exception as e:
            self.logger.error("Error in generate_response: %s", str(e))
            return {
                "query": "",
                "response": "Please try again later",
                "context": self.context[uuid],
            }

    def get_llm(self):
        return self
