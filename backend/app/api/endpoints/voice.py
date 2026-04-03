"""
Voice transcription endpoint — uses OpenAI Whisper via faster-whisper (local, offline).
Falls back gracefully if faster-whisper is not installed.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
import io
import os
import tempfile

router = APIRouter(tags=["voice"])


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Accepts a webm/ogg/wav audio blob, runs Whisper locally, returns transcript.
    Works on HTTP localhost — no Google servers needed.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="faster-whisper is not installed. Run: pip install faster-whisper"
        )

    # Read the uploaded audio bytes
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    # Write to a temp file (whisper needs a file path)
    suffix = ".webm"
    if audio.filename:
        ext = os.path.splitext(audio.filename)[-1]
        if ext in (".wav", ".mp3", ".ogg", ".webm", ".m4a"):
            suffix = ext

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # Use the tiny model — fast, offline, no GPU needed
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        segments, info = model.transcribe(tmp_path, beam_size=5)
        transcript = " ".join(seg.text.strip() for seg in segments).strip()
        return {
            "transcript": transcript,
            "language": info.language,
            "duration": round(info.duration, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass
