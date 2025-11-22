import operator
from typing import Annotated, List, Optional, TypedDict, Union
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    # 1. The Conversation History (Standard)
    messages: Annotated[List[BaseMessage], operator.add]
    
    # 2. Context Awareness (What page is the user on?)
    current_page: str  # 'busDashboard' or 'manageRoute'
    
    # 3. Operation Context (The "Tribal Knowledge" variables)
    target_trip_id: Optional[str]  # The ID of the trip being modified
    consequence_risk: Optional[str]  # 'HIGH', 'LOW', or None
    consequence_message: Optional[str] # "Warning: Trip is 25% booked."
    awaiting_confirmation: bool # True if we are waiting for user to say "Yes"