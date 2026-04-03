from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from app.models.schemas import DBConnectionRequest, DBConnectionResponse
from app.services.db_service import DBService
from app.services.ai_service import AIService
from app.services.dialect_converter import DialectConverter
from pydantic import BaseModel
import logging
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=DBConnectionResponse)
async def connect_db(request: DBConnectionRequest):
    """
    Connects to a source database, verifies connection, 
    and creates a shadow clone of the schema.
    """
    logger.info(f"Received connection request for project: {request.project_name}")
    
    # 1. Verify Connection
    if not DBService.verify_connection(request.connection_string):
        raise HTTPException(status_code=400, detail="Could not connect to source database.")
    
    # 2. Create Shadow Clone
    try:
        DBService.create_shadow_clone(request.connection_string)
    except Exception as e:
        logger.error(f"Shadow cloning failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create shadow database: {str(e)}")
    
    # 3. Get Stats (from source or shadow? usually shadow to verify)
    # let's get from shadow to confirm it worked, but connection string for shadow is internal
    # using source for now for strict prompt compliance? 
    # Actually, we should check shadow. But let's stick to `DBService` method.
    # The `verify_connection` used source. 
    # Let's count tables in the *Source* to show what we found.
    
    table_count = DBService.get_table_count(request.connection_string)
    
    project_id = str(uuid.uuid4())
    
    return DBConnectionResponse(
        success=True,
        project_id=project_id,
        message="Successfully connected and created shadow clone.",
        table_count=table_count
    )

@router.post("/upload-sql", response_model=DBConnectionResponse)
async def upload_sql(
    project_name: str,
    file: UploadFile = File(...),
    dialect: str = Query(default="postgresql", description="Source SQL dialect: postgresql, mysql, sqlite, mssql, oracle")
):
    """
    Accepts a .sql file and creates a dedicated PostgreSQL database from it.
    If the file is not in PostgreSQL dialect, it will be converted automatically.
    """
    logger.info(f"Received SQL file upload for project: {project_name}, dialect: {dialect}")

    if dialect.lower() not in DialectConverter.SUPPORTED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported dialect '{dialect}'. Supported: {', '.join(DialectConverter.SUPPORTED)}"
        )

    if not file.filename.endswith('.sql'):
        raise HTTPException(status_code=400, detail="Only .sql files are allowed.")

    try:
        content = await file.read()
        sql_content = content.decode("utf-8")

        # Convert to PostgreSQL if needed
        if dialect.lower() != "postgresql":
            logger.info(f"Converting SQL from '{dialect}' dialect to PostgreSQL...")
            try:
                sql_content = DialectConverter.convert(sql_content, dialect)
                logger.info("Dialect conversion successful.")
            except Exception as conv_err:
                raise HTTPException(
                    status_code=422,
                    detail=f"Dialect conversion failed: {str(conv_err)}"
                )

        # Create dedicated isolated database
        new_db_url = DBService.create_dedicated_db_from_sql(sql_content, project_name)

        # Verify by getting table count from the new DB
        table_count = DBService.get_table_count(new_db_url)

        project_id = str(uuid.uuid4())

        return DBConnectionResponse(
            success=True,
            project_id=project_id,
            message=f"Successfully created dedicated database from {dialect.upper()} SQL file.",
            table_count=table_count,
            connection_string=new_db_url
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SQL upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process SQL file: {str(e)}")

class GenerateSchemaRequest(BaseModel):
    description: str
    project_name: str = "AI Generated Project"

@router.post("/generate-schema", response_model=DBConnectionResponse)
async def generate_schema(request: GenerateSchemaRequest):
    """
    Generates a SQL schema using AI and creates a shadow clone from it.
    """
    logger.info(f"Received AI schema generation request for: {request.project_name}")
    
    try:
        ai_service = AIService()
        sql_content = await ai_service.generate_sql_schema(request.description)
        
        # Save SQL to local file
        import os
        from datetime import datetime
        
        output_dir = "generated_schemas"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_project_name = "".join([c for c in request.project_name if c.isalnum() or c in (' ', '_', '-')]).rstrip()
        filename = f"{safe_project_name.replace(' ', '_')}_{timestamp}.sql"
        file_path = os.path.join(output_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sql_content)
            
        logger.info(f"Saved generated schema to: {file_path}")

        # Create dedicated DB from generated SQL
        new_db_url = DBService.create_dedicated_db_from_sql(sql_content, request.project_name)
        
        # Verify
        table_count = DBService.get_table_count(new_db_url)
        
        project_id = str(uuid.uuid4())
        
        return DBConnectionResponse(
            success=True,
            project_id=project_id,
            message="Successfully generated schema and created dedicated database.",
            table_count=table_count,
            file_path=os.path.abspath(file_path),
            connection_string=new_db_url
        )
        
    except Exception as e:
        logger.error(f"Schema generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate schema: {str(e)}")

class MongoDBConnectionRequest(BaseModel):
    connection_string: str
    project_name: str = "My MongoDB"

@router.post("/mongodb", response_model=DBConnectionResponse)
async def connect_mongodb(request: MongoDBConnectionRequest):
    """
    Connects to a user's MongoDB database and returns collection info.
    """
    from app.services.mongodb_service import MongoDBService
    logger.info(f"MongoDB connection request for project: {request.project_name}")

    if not MongoDBService.verify_connection(request.connection_string):
        raise HTTPException(status_code=400, detail="Could not connect to MongoDB. Check your URI and network access.")

    try:
        service = MongoDBService(request.connection_string)
        collection_count = service.get_collection_count()
        project_id = str(uuid.uuid4())

        return DBConnectionResponse(
            success=True,
            project_id=project_id,
            message=f"Connected to MongoDB. Found {collection_count} collections.",
            table_count=collection_count,
            connection_string=request.connection_string,
        )
    except Exception as e:
        logger.error(f"MongoDB connection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MongoDB connection error: {str(e)}")


class FirebaseConnectionRequest(BaseModel):
    service_account_json: str
    project_name: str = "My Firestore"

@router.post("/firebase", response_model=DBConnectionResponse)
async def connect_firebase(request: FirebaseConnectionRequest):
    """
    Connects to a user's Firestore database using a service account JSON string.
    """
    from app.services.firebase_service import FirebaseService
    logger.info(f"Firebase connection request for project: {request.project_name}")

    if not FirebaseService.verify_connection(request.service_account_json):
        raise HTTPException(status_code=400, detail="Could not connect to Firestore. Check your service account JSON and project permissions.")

    try:
        service = FirebaseService(request.service_account_json)
        collection_count = service.get_collection_count()
        project_id = str(uuid.uuid4())

        return DBConnectionResponse(
            success=True,
            project_id=project_id,
            message=f"Connected to Firestore project '{service.project_id}'. Found {collection_count} collections.",
            table_count=collection_count,
            connection_string=request.service_account_json,
        )
    except Exception as e:
        logger.error(f"Firebase connection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Firebase connection error: {str(e)}")


class GitHubImportRequest(BaseModel):
    github_url: str
    project_name: str = "GitHub Import"

@router.post("/import-github", response_model=DBConnectionResponse)
async def import_from_github(request: GitHubImportRequest):
    """
    Fetches a SQL file from a public GitHub URL and creates a shadow database from it.
    Accepts both blob URLs (github.com/user/repo/blob/branch/file.sql)
    and raw URLs (raw.githubusercontent.com/...).
    """
    logger.info(f"GitHub import request for: {request.github_url}")

    try:
        import httpx, re, os
        from datetime import datetime

        url = request.github_url.strip()

        # Convert GitHub blob URL → raw URL
        # e.g. https://github.com/user/repo/blob/main/schema.sql
        #   → https://raw.githubusercontent.com/user/repo/main/schema.sql
        if "github.com" in url and "/blob/" in url:
            url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
        elif "github.com" in url and "/blob/" not in url and "raw.githubusercontent.com" not in url:
            raise ValueError("Please provide a direct link to a .sql file on GitHub.")

        if not url.endswith(".sql"):
            raise ValueError("The URL must point to a .sql file.")

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise ValueError(f"Could not fetch file (HTTP {response.status_code}). Make sure the repository is public.")
            sql_content = response.text

        if not sql_content.strip():
            raise ValueError("Fetched file is empty.")

        # Save to local file
        output_dir = "generated_schemas"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r'[^\w\-]', '_', request.project_name)
        filename = f"{safe_name}_{timestamp}.sql"
        file_path = os.path.join(output_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sql_content)
        logger.info(f"Saved GitHub schema to: {file_path}")

        # Create dedicated DB
        new_db_url = DBService.create_dedicated_db_from_sql(sql_content, request.project_name)

        table_count = DBService.get_table_count(new_db_url)
        project_id = str(uuid.uuid4())

        return DBConnectionResponse(
            success=True,
            project_id=project_id,
            message=f"Successfully imported schema from GitHub and created dedicated database.",
            table_count=table_count,
            file_path=os.path.abspath(file_path),
            connection_string=new_db_url
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"GitHub import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import from GitHub: {str(e)}")
