"""
Provider-agnostic LLM wrapper.

Switch providers by setting the LLM_PROVIDER env var:
  - "anthropic" (default) — uses ANTHROPIC_API_KEY
  - "openai" — uses OPENAI_API_KEY

No code changes needed to swap providers.

Two quality tiers — pass quality="fast" or quality="smart":
  - "fast"  → cheap, quick model for sentence/passage/validation tasks
  - "smart" → better model for writing assessment and mistake analysis
"""

import os
import json


# Model tiers — edit these to swap models without touching any other code
ANTHROPIC_FAST_MODEL  = "claude-haiku-4-5-20251001"
ANTHROPIC_SMART_MODEL = "claude-sonnet-4-5"

OPENAI_FAST_MODEL  = "gpt-4o-mini"
OPENAI_SMART_MODEL = "gpt-4o"


def call_llm(system_prompt, user_prompt, quality="fast", thinking_budget=None):
    """
    Call the configured LLM provider and return the response text.

    Args:
        system_prompt:   The system/instruction prompt.
        user_prompt:     The user message.
        quality:         "fast" (default) or "smart". Selects the model tier.
        thinking_budget: If set (int), enables extended thinking on Anthropic with this
                         token budget. Ignored for OpenAI. Automatically implies "smart".

    Returns:
        The response text as a string.

    Raises:
        Exception with a descriptive message on failure.
    """
    if thinking_budget:
        quality = "smart"

    provider = os.environ.get("LLM_PROVIDER", "anthropic").lower()

    if provider == "anthropic":
        return _call_anthropic(system_prompt, user_prompt, quality, thinking_budget)
    elif provider == "openai":
        return _call_openai(system_prompt, user_prompt, quality)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Use 'anthropic' or 'openai'.")


def _call_anthropic(system_prompt, user_prompt, quality="fast", thinking_budget=None):
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in .env file.")

    client = anthropic.Anthropic(api_key=api_key)
    model = ANTHROPIC_SMART_MODEL if quality == "smart" else ANTHROPIC_FAST_MODEL

    kwargs = dict(
        model=model,
        max_tokens=16000 if thinking_budget else 4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    if thinking_budget:
        kwargs["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}

    response = client.messages.create(**kwargs)

    # With extended thinking the response has mixed blocks; return only the text block.
    for block in response.content:
        if block.type == "text":
            return block.text
    return response.content[0].text


def _call_openai(system_prompt, user_prompt, quality="fast"):
    import openai

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in .env file.")

    client = openai.OpenAI(api_key=api_key)
    model = OPENAI_SMART_MODEL if quality == "smart" else OPENAI_FAST_MODEL

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
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_fix_unescaped_control_chars(text))
