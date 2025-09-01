"""
Graphiti Memory Service for AI Agents
Provides temporally-aware knowledge graph capabilities via REST API
"""

import os
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
import uvicorn
from dotenv import load_dotenv

# Import Graphiti components
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.edges import EntityEdge


# Load environment variables
load_dotenv()

# Global Graphiti client
graphiti_client: Optional[Graphiti] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Graphiti client on startup"""
    global graphiti_client
    
    try:
        # Initialize Graphiti with Neo4j connection
        neo4j_uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
        neo4j_user = os.getenv('NEO4J_USER', 'neo4j')
        neo4j_password = os.getenv('NEO4J_PASSWORD', 'password')
        
        print(f"Connecting to Neo4j at {neo4j_uri}")
        
        graphiti_client = Graphiti(
            uri=neo4j_uri,
            user=neo4j_user,
            password=neo4j_password,
        )
        
        # Build indices and constraints (skip if Neo4j Community Edition)
        try:
            await graphiti_client.build_indices_and_constraints()
            print("Graphiti client initialized successfully")
        except Exception as e:
            if "Vector indexes are not available" in str(e):
                print(f"Warning: Skipping vector index creation (Neo4j Community Edition): {e}")
                print("Graphiti client initialized with limited functionality")
            else:
                print(f"Failed to build indices: {e}")
                raise
        
    except Exception as e:
        print(f"Failed to initialize Graphiti: {e}")
        raise
    
    yield
    
    # Cleanup on shutdown
    if graphiti_client:
        print("Shutting down Graphiti client")


# Create FastAPI app with lifespan
app = FastAPI(
    title="Graphiti Memory Service",
    description="Temporally-aware knowledge graph for AI agents",
    version="1.0.0",
    lifespan=lifespan
)


def get_graphiti_client() -> Graphiti:
    """Dependency to get Graphiti client"""
    if graphiti_client is None:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")
    return graphiti_client


# Pydantic models for request/response
class AddEpisodeRequest(BaseModel):
    user_id: str
    name: str
    episode_body: str
    source: str  # 'message', 'event', 'task_completion', 'goal_update'
    reference_time: Optional[datetime] = None
    source_description: Optional[str] = None


class SearchRequest(BaseModel):
    user_id: str
    query: str
    center_node_uuid: Optional[str] = None
    num_results: int = 10


class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    center_node_uuid: Optional[str] = None


class MemoryContextRequest(BaseModel):
    user_id: str
    context_type: str  # 'conversation', 'task_planning', 'goal_coaching'
    query: Optional[str] = None
    limit: int = 10


class UserNodeResponse(BaseModel):
    user_node_uuid: str
    created: bool


# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "graphiti-memory"}


@app.post("/episodes", response_model=Dict[str, str])
async def add_episode(
    request: AddEpisodeRequest,
    client: Graphiti = Depends(get_graphiti_client)
):
    """Add an episode (event, conversation, task completion) to the knowledge graph"""
    try:
        # Map source string to EpisodeType
        source_mapping = {
            'message': EpisodeType.message,
            'event': EpisodeType.event,
            'task': EpisodeType.text,
            'goal': EpisodeType.text,
            'text': EpisodeType.text,
            'json': EpisodeType.json,
        }
        
        episode_type = source_mapping.get(request.source.lower(), EpisodeType.text)
        reference_time = request.reference_time or datetime.now(timezone.utc)
        
        # Add episode to Graphiti
        await client.add_episode(
            name=request.name,
            episode_body=request.episode_body,
            source=episode_type,
            reference_time=reference_time,
            source_description=request.source_description,
        )
        
        return {"status": "success", "message": "Episode added successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add episode: {str(e)}")


@app.post("/search", response_model=SearchResponse)
async def search_knowledge(
    request: SearchRequest,
    client: Graphiti = Depends(get_graphiti_client)
):
    """Search the knowledge graph for relevant information"""
    try:
        # Perform semantic search
        results = await client.search(
            query=request.query,
            center_node_uuid=request.center_node_uuid,
            num_results=request.num_results
        )
        
        # Convert EntityEdge results to serializable format
        serialized_results = []
        for edge in results:
            if isinstance(edge, EntityEdge):
                serialized_results.append({
                    "fact": edge.fact,
                    "uuid": getattr(edge, 'uuid', None),
                    "created_at": getattr(edge, 'created_at', None),
                    "source": getattr(edge, 'source', None),
                })
            else:
                # Handle other result types
                serialized_results.append({
                    "content": str(edge),
                    "type": type(edge).__name__
                })
        
        return SearchResponse(
            results=serialized_results,
            center_node_uuid=request.center_node_uuid
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/users/{user_id}/node", response_model=UserNodeResponse)
async def ensure_user_node(
    user_id: str,
    client: Graphiti = Depends(get_graphiti_client)
):
    """Ensure a user node exists in the graph and return its UUID"""
    try:
        # Create an episode that mentions the user to ensure they have a node
        await client.add_episode(
            name=f"User {user_id} Profile",
            episode_body=f"User {user_id} is using the personal intelligence system",
            source=EpisodeType.text,
            reference_time=datetime.now(timezone.utc),
            source_description="User Profile Creation",
        )
        
        # Search for the user's node
        from graphiti_core.search.search_config_recipes import NODE_HYBRID_SEARCH_EPISODE_MENTIONS
        
        search_result = await client._search(user_id, NODE_HYBRID_SEARCH_EPISODE_MENTIONS)
        
        if search_result.nodes:
            user_node_uuid = search_result.nodes[0].uuid
            return UserNodeResponse(user_node_uuid=user_node_uuid, created=False)
        else:
            raise HTTPException(status_code=404, detail=f"Could not find or create user node for {user_id}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ensure user node: {str(e)}")


@app.post("/users/{user_id}/context")
async def get_memory_context(
    user_id: str,
    request: MemoryContextRequest,
    client: Graphiti = Depends(get_graphiti_client)
):
    """Get contextual memory for a user based on their current situation"""
    try:
        # First ensure user node exists
        user_node_response = await ensure_user_node(user_id, client)
        center_node_uuid = user_node_response.user_node_uuid
        
        # Build context-specific query
        if request.context_type == 'conversation':
            query = request.query or f"Recent conversations and interactions with {user_id}"
        elif request.context_type == 'task_planning':
            query = request.query or f"{user_id} task completion patterns and productivity insights"
        elif request.context_type == 'goal_coaching':
            query = request.query or f"{user_id} goals, progress, and personal development"
        else:
            query = request.query or f"General context about {user_id}"
        
        # Search for relevant context
        results = await client.search(
            query=query,
            center_node_uuid=center_node_uuid,
            num_results=request.limit
        )
        
        # Format results for agent consumption
        context_facts = []
        for edge in results:
            if isinstance(edge, EntityEdge):
                context_facts.append({
                    "fact": edge.fact,
                    "relevance": "high",  # Could add scoring later
                    "timestamp": getattr(edge, 'created_at', None),
                })
        
        return {
            "user_id": user_id,
            "context_type": request.context_type,
            "user_node_uuid": center_node_uuid,
            "facts": context_facts,
            "total_facts": len(context_facts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get memory context: {str(e)}")


@app.delete("/graph/clear")
async def clear_graph(
    client: Graphiti = Depends(get_graphiti_client)
):
    """Clear all data from the graph (development only)"""
    try:
        from graphiti_core.utils.maintenance.graph_data_operations import clear_data
        
        await clear_data(client.driver)
        await client.build_indices_and_constraints()
        
        return {"status": "success", "message": "Graph cleared successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear graph: {str(e)}")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)