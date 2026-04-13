from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import base64
import io
from PIL import Image
from app.services.ai_service import AIService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
ai_service = AIService()

class VisionResponse(BaseModel):
    sql_ddl: str
    error: str | None = None

@router.post("/upload-schema", response_model=VisionResponse)
async def upload_schema_vision(file: UploadFile = File(...)):
    """
    Accepts an image file (e.g. whiteboard sketch, ER diagram) and uses Vision AI
    to convert it directly into PostgreSQL DDL statements.
    """
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")
        
    try:
        contents = await file.read()
        
        # Resize image to prevent massive VRAM spikes in Ollama
        try:
            img = Image.open(io.BytesIO(contents))
            # Convert to RGB to avoid alpha channel issues with some models
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img.thumbnail((1024, 1024))
            buf = io.BytesIO()
            img.save(buf, format='JPEG')
            contents = buf.getvalue()
        except Exception as e:
            logger.warning(f"Failed to resize image, continuing with original: {e}")
            
        base64_img = base64.b64encode(contents).decode('utf-8')
        
        sql_ddl = await ai_service.generate_schema_from_image(base64_img)
        
        return VisionResponse(sql_ddl=sql_ddl)
    except Exception as e:
        logger.error(f"Vision schema upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
