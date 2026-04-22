"""
Provider-agnostic LLM wrapper.

Switch providers by setting the LLM_PROVIDER env var:
  - "anthropic" (default) — uses ANTHROPIC_API_KEY
  - "openai" — uses OPENAI_API_KEY

No code changes needed to swap providers.
"""

import os
import json


# Default models — change these if you want a different model
ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5"
OPENAI_DEFAULT_MODEL = "gpt-4o"


def call_llm(system_prompt, user_prompt, model=None):
    """
    Call the configured LLM provider and return the response text.

    Args:
        system_prompt: The system/instruction prompt.
        user_prompt: The user message.
        model: Override the default model (optional).

    Returns:
        The response text as a string.

    Raises:
        Exception with a descriptive message on failure.
    """
    provider = os.environ.get("LLM_PROVIDER", "anthropic").lower()

    if provider == "anthropic":
        return _call_anthropic(system_prompt, user_prompt, model)
    elif provider == "openai":
        return _call_openai(system_prompt, user_prompt, model)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Use 'anthropic' or 'openai'.")


def _call_anthropic(system_prompt, user_prompt, model=None):
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in .env file.")

    client = anthropic.Anthropic(api_key=api_key)
    model = model or ANTHROPIC_DEFAULT_MODEL

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    return response.content[0].text


def _call_openai(system_prompt, user_prompt, model=None):
    import openai

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in .env file.")

    client = openai.OpenAI(api_key=api_key)
    model = model or OPENAI_DEFAULT_MODEL

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    return response.choices[0].message.content


def generate_tts_audio(text, voice="nova"):
    """
    Generate TTS audio using OpenAI's tts-1 model.

    Returns a base64-encoded MP3 string, or None if unavailable.
    """
    import base64

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
        )
        audio_bytes = response.content
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception:
        return None


def _fix_unescaped_control_chars(text):
    """Fix unescaped newlines/tabs within JSON string values."""
    result = []
    in_string = False
    escape_next = False

    for char in text:
        if escape_next:
            result.append(char)
            escape_next = False
        elif char == '\\' and in_string:
            result.append(char)
            escape_next = True
        elif char == '"':
            in_string = not in_string
            result.append(char)
        elif in_string and char == '\n':
            result.append('\\n')
        elif in_string and char == '\r':
            result.append('\\r')
        elif in_string and char == '\t':
            result.append('\\t')
        else:
            result.append(char)

    return ''.join(result)


def parse_json_response(text):
    """
    Parse a JSON object/array from LLM response text.
    Handles markdown code fences and unescaped control characters in strings.
    """
    text = text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # LLM may have included literal newlines inside string values — fix and retry
        return json.loads(_fix_unescaped_control_chars(text))
