
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage
from tools import create_calendar_event, get_calendar_events, update_calendar_event, delete_calendar_event

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

class Graph:
    def __init__(self):
        self.tools = [get_calendar_events, create_calendar_event, update_calendar_event, delete_calendar_event]
        self.model = ChatOpenAI(temperature=0, streaming=True)
        self.tool_node = ToolNode(self.tools)
        self.model = self.model.bind_tools(self.tools)
        self.graph = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(AgentState)
        graph.add_node("llm", self.call_model)
        graph.add_node("tools", self.tool_node)
        graph.add_conditional_edges(
            "llm",
            self.should_continue,
            {
                "continue": "tools",
                "end": END,
            },
        )
        graph.add_edge("tools", "llm")
        graph.set_entry_point("llm")
        return graph.compile()

    def should_continue(self, state):
        messages = state["messages"]
        last_message = messages[-1]
        if not last_message.tool_calls:
            return "end"
        else:
            return "continue"

    def call_model(self, state):
        messages = state["messages"]
        response = self.model.invoke(messages)
        return {"messages": [response]}

    def run(self, messages):
        return self.graph.invoke({"messages": messages})
