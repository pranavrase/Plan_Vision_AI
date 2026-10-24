import json
import time
from io import BytesIO
from typing import Any

# pyrefly: ignore [missing-import]
from PIL import Image
# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import types

from app.core.config import settings


class GeminiClient:
    """
    Gemini client for the Civil Blueprint OCR application.

    Features:
    - Modern google-genai SDK
    - Image analysis
    - JSON/structured output
    - Response schema support
    - Automatic retry for temporary 503 errors
    - Fallback model support
    - Compatibility with the existing OCR pipeline
    """

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is not configured. "
                "Add your Gemini API key to backend/.env"
            )

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        self.model = settings.GEMINI_MODEL
        self.model_name = settings.GEMINI_MODEL

        # Fallback model
        self.fallback_model = "gemini-3.5-flash-lite"

        # Retry settings
        self.max_retries = 3
        self.retry_delays = [2, 4, 8]

    # ============================================================
    # RESPONSE TO TEXT
    # ============================================================

    def _response_to_text(
        self,
        response: Any
    ) -> str:
        """
        Convert GenerateContentResponse to plain text.

        google-genai returns a GenerateContentResponse object.
        The generated text is available through response.text.
        """

        if response is None:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        # --------------------------------------------------------
        # NORMAL MODERN SDK RESPONSE
        # --------------------------------------------------------

        text = getattr(
            response,
            "text",
            None
        )

        if text is not None:

            text = str(text).strip()

            if text:
                return text

        # --------------------------------------------------------
        # FALLBACK CANDIDATE PARSING
        # --------------------------------------------------------

        try:

            candidates = getattr(
                response,
                "candidates",
                None
            )

            if candidates:

                first_candidate = candidates[0]

                content = getattr(
                    first_candidate,
                    "content",
                    None
                )

                if content:

                    parts = getattr(
                        content,
                        "parts",
                        []
                    )

                    text_parts = []

                    for part in parts:

                        part_text = getattr(
                            part,
                            "text",
                            None
                        )

                        if part_text:

                            text_parts.append(
                                str(part_text)
                            )

                    combined_text = "".join(
                        text_parts
                    ).strip()

                    if combined_text:
                        return combined_text

        except Exception:
            pass

        raise RuntimeError(
            "Gemini returned a response, "
            "but no text could be extracted."
        )

    # ============================================================
    # SCHEMA CLEANING
    # ============================================================

    def _clean_response_schema(
        self,
        schema: Any
    ) -> Any:
        """
        Recursively clean the response schema.
        """

        if schema is None:
            return None

        if isinstance(
            schema,
            dict
        ):

            cleaned = {}

            for key, value in schema.items():

                # Remove unsupported schema property
                if key == "additionalProperties":
                    continue

                cleaned[key] = (
                    self._clean_response_schema(
                        value
                    )
                )

            return cleaned

        if isinstance(
            schema,
            list
        ):

            return [
                self._clean_response_schema(
                    item
                )
                for item in schema
            ]

        return schema

    # ============================================================
    # IMAGE TO GEMINI PART
    # ============================================================

    def _convert_image_to_part(
        self,
        image: Any
    ) -> types.Part:
        """
        Convert supported image types into Gemini Part.

        Supported:
        - PIL Image
        - bytes
        - google.genai.types.Part
        """

        # --------------------------------------------------------
        # ALREADY A GEMINI PART
        # --------------------------------------------------------

        if isinstance(
            image,
            types.Part
        ):

            return image

        # --------------------------------------------------------
        # BYTES
        # --------------------------------------------------------

        if isinstance(
            image,
            bytes
        ):

            return types.Part.from_bytes(
                data=image,
                mime_type="image/jpeg"
            )

        # --------------------------------------------------------
        # PIL IMAGE
        # --------------------------------------------------------

        if isinstance(
            image,
            Image.Image
        ):

            image_buffer = BytesIO()

            image_format = (
                image.format
                or "PNG"
            )

            if image_format.upper() == "JPG":
                image_format = "JPEG"

            image.save(
                image_buffer,
                format=image_format
            )

            image_bytes = (
                image_buffer.getvalue()
            )

            if image_format.upper() == "PNG":

                mime_type = "image/png"

            elif image_format.upper() in (
                "JPG",
                "JPEG"
            ):

                mime_type = "image/jpeg"

            elif image_format.upper() == "WEBP":

                mime_type = "image/webp"

            elif image_format.upper() == "GIF":

                mime_type = "image/gif"

            else:

                mime_type = "image/png"

            return types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )

        raise TypeError(
            f"Unsupported image type: "
            f"{type(image)}. "
            "Expected PIL Image, bytes, or "
            "google.genai.types.Part."
        )

    # ============================================================
    # GEMINI REQUEST WITH RETRY
    # ============================================================

    def _generate_with_retry(
        self,
        model: str,
        contents: Any,
        config: Any = None
    ):
        """
        Generate Gemini content.

        Handles temporary 503 errors using retries
        and then falls back to another model.
        """

        last_error = None

        # --------------------------------------------------------
        # PRIMARY MODEL RETRIES
        # --------------------------------------------------------

        for attempt in range(
            self.max_retries
        ):

            try:

                return self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )

            except Exception as exc:

                last_error = exc

                error_text = str(exc)

                is_temporary = (
                    "503" in error_text
                    or "UNAVAILABLE" in error_text
                    or "high demand"
                    in error_text.lower()
                    or "temporarily"
                    in error_text.lower()
                )

                # If this isn't a temporary service problem,
                # immediately raise the original error.
                if not is_temporary:
                    raise

                # Last retry
                if (
                    attempt
                    >= self.max_retries - 1
                ):
                    break

                delay = self.retry_delays[
                    min(
                        attempt,
                        len(
                            self.retry_delays
                        ) - 1
                    )
                ]

                print(
                    "Gemini temporarily unavailable. "
                    f"Retrying in {delay} seconds..."
                )

                time.sleep(delay)

        # --------------------------------------------------------
        # FALLBACK MODEL
        # --------------------------------------------------------

        if model != self.fallback_model:

            print(
                f"Primary model '{model}' "
                "is unavailable."
            )

            print(
                f"Trying fallback model "
                f"'{self.fallback_model}'..."
            )

            try:

                return self.client.models.generate_content(
                    model=self.fallback_model,
                    contents=contents,
                    config=config
                )

            except Exception as fallback_error:

                raise RuntimeError(
                    "Gemini processing failed.\n\n"
                    f"Primary model: {model}\n"
                    f"Primary error: {last_error}\n\n"
                    f"Fallback model: "
                    f"{self.fallback_model}\n"
                    f"Fallback error: "
                    f"{fallback_error}"
                ) from fallback_error

        # --------------------------------------------------------
        # FINAL ERROR
        # --------------------------------------------------------

        raise RuntimeError(
            f"Gemini processing failed: "
            f"{last_error}"
        ) from last_error

    # ============================================================
    # COMPATIBILITY GENERATE_CONTENT
    # ============================================================

    def generate_content(
        self,
        *args,
        **kwargs
    ):
        """
        Compatibility method used by the existing OCR pipeline.

        IMPORTANT:
        This method returns a STRING, not a
        GenerateContentResponse object.

        This is required because the existing OCR pipeline
        expects to call string operations such as .strip().
        """

        # --------------------------------------------------------
        # OLD-STYLE PARAMETERS
        # --------------------------------------------------------

        prompt = kwargs.pop(
            "prompt",
            None
        )

        image = kwargs.pop(
            "image",
            None
        )

        response_schema = kwargs.pop(
            "response_schema",
            None
        )

        response_mime_type = kwargs.pop(
            "response_mime_type",
            None
        )

        generation_config = kwargs.pop(
            "generation_config",
            None
        )

        config = kwargs.pop(
            "config",
            None
        )

        # --------------------------------------------------------
        # CONTENTS
        # --------------------------------------------------------

        if "contents" in kwargs:

            contents = kwargs.pop(
                "contents"
            )

        else:

            contents = []

            if image is not None:

                image_part = (
                    self._convert_image_to_part(
                        image
                    )
                )

                contents.append(
                    image_part
                )

            if prompt is not None:

                contents.append(
                    prompt
                )

        # --------------------------------------------------------
        # MODEL
        # --------------------------------------------------------

        model = kwargs.pop(
            "model",
            self.model
        )

        # --------------------------------------------------------
        # CONFIGURATION
        # --------------------------------------------------------

        final_config = config

        if final_config is None:

            config_kwargs = {}

            # ----------------------------------------------------
            # RESPONSE SCHEMA
            # ----------------------------------------------------

            if response_schema is not None:

                cleaned_schema = (
                    self._clean_response_schema(
                        response_schema
                    )
                )

                config_kwargs[
                    "response_schema"
                ] = cleaned_schema

                config_kwargs[
                    "response_mime_type"
                ] = (
                    response_mime_type
                    or "application/json"
                )

            elif response_mime_type is not None:

                config_kwargs[
                    "response_mime_type"
                ] = response_mime_type

            # ----------------------------------------------------
            # GENERATION CONFIG
            # ----------------------------------------------------

            if generation_config is not None:

                if isinstance(
                    generation_config,
                    dict
                ):

                    if (
                        "response_schema"
                        in generation_config
                    ):

                        generation_config[
                            "response_schema"
                        ] = (
                            self._clean_response_schema(
                                generation_config[
                                    "response_schema"
                                ]
                            )
                        )

                    config_kwargs.update(
                        generation_config
                    )

                else:

                    final_config = (
                        generation_config
                    )

            # ----------------------------------------------------
            # CREATE GEMINI CONFIG
            # ----------------------------------------------------

            if (
                final_config is None
                and config_kwargs
            ):
                config_kwargs["temperature"] = 0.0
                final_config = (
                    types.GenerateContentConfig(
                        **config_kwargs
                    )
                )

        # --------------------------------------------------------
        # SEND REQUEST
        # --------------------------------------------------------

        response = self._generate_with_retry(
            model=model,
            contents=contents,
            config=final_config
        )

        # --------------------------------------------------------
        # IMPORTANT FIX
        #
        # Convert GenerateContentResponse
        # into a normal Python string.
        #
        # Existing OCR code can now safely do:
        #
        # response.strip()
        # json.loads(response)
        #
        # etc.
        # --------------------------------------------------------

        return self._response_to_text(
            response
        )

    # ============================================================
    # IMAGE ANALYSIS
    # ============================================================

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str
    ) -> str:
        """
        Analyze an image and return plain text.
        """

        image_part = (
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        )

        response = (
            self._generate_with_retry(
                model=self.model,
                contents=[
                    image_part,
                    prompt
                ]
            )
        )

        return self._response_to_text(
            response
        )

    # ============================================================
    # IMAGE ANALYSIS WITH JSON
    # ============================================================

    def analyze_image_json(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        response_schema: Any = None
    ) -> dict[str, Any]:
        """
        Analyze blueprint image and return JSON.
        """

        image_part = (
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        )

        # --------------------------------------------------------
        # CONFIG
        # --------------------------------------------------------

        config_kwargs = {
            "response_mime_type": "application/json",
            "temperature": 0.0
        }

        if response_schema is not None:

            config_kwargs[
                "response_schema"
            ] = (
                self._clean_response_schema(
                    response_schema
                )
            )

        config = (
            types.GenerateContentConfig(
                **config_kwargs
            )
        )

        # --------------------------------------------------------
        # GEMINI REQUEST
        # --------------------------------------------------------

        response = (
            self._generate_with_retry(
                model=self.model,
                contents=[
                    image_part,
                    prompt
                ],
                config=config
            )
        )

        # --------------------------------------------------------
        # RESPONSE -> TEXT
        # --------------------------------------------------------

        response_text = (
            self._response_to_text(
                response
            )
        )

        response_text = (
            response_text.strip()
        )

        # --------------------------------------------------------
        # REMOVE MARKDOWN CODE FENCES
        # --------------------------------------------------------

        if response_text.startswith(
            "```json"
        ):

            response_text = (
                response_text[7:]
            )

        elif response_text.startswith(
            "```"
        ):

            response_text = (
                response_text[3:]
            )

        if response_text.endswith(
            "```"
        ):

            response_text = (
                response_text[:-3]
            )

        response_text = (
            response_text.strip()
        )

        # --------------------------------------------------------
        # PARSE JSON
        # --------------------------------------------------------

        try:

            result = json.loads(
                response_text
            )

        except json.JSONDecodeError as exc:

            raise RuntimeError(
                "Gemini returned invalid JSON.\n\n"
                f"JSON parsing error: {exc}\n\n"
                "Gemini response:\n"
                f"{response_text}"
            ) from exc

        # --------------------------------------------------------
        # VERIFY DICTIONARY
        # --------------------------------------------------------

        if not isinstance(
            result,
            dict
        ):

            raise RuntimeError(
                "Gemini returned valid JSON, "
                "but the result is not a JSON object."
            )

        return result