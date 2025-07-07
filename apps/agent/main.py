from fastapi import FastAPI
from pydantic import BaseModel
from graph import Graph
from langchain_core.messages import HumanMessage

app = FastAPI()
graph = Graph()

class Request(BaseModel):
    message: str

@app.post("/invoke")
def invoke(request: Request):
    messages = [HumanMessage(content=request.message)]
    result = graph.run(messages)
    return {"response": result["messages"][-1].content}
