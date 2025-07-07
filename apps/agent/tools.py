from langchain_core.tools import tool
from typing import Optional

@tool
def create_calendar_event(time: str, description: str):
    """Create a new calendar event."""
    print(f"Creating event at {time} with description: {description}")
    return f"Event created at {time}."

@tool
def get_calendar_events(time: str):
    """Get all calendar events for a given time."""
    print(f"Getting events at {time}")
    return f"Events at {time}: [Event 1, Event 2]"

@tool
def update_calendar_event(event_id: str, event_title: Optional[str] = None, event_starts_at: Optional[str] = None, event_ends_at: Optional[str] = None, event_location: Optional[str] = None, event_description: Optional[str] = None):
    """Update an existing calendar event."""
    # In a real implementation, you would connect to a calendar API
    # and update the event with the provided details.
    update_fields = []
    if event_title:
        update_fields.append(f"title='{event_title}'")
    if event_starts_at:
        update_fields.append(f"starts_at='{event_starts_at}'")
    if event_ends_at:
        update_fields.append(f"ends_at='{event_ends_at}'")
    if event_location:
        update_fields.append(f"location='{event_location}'")
    if event_description:
        update_fields.append(f"description='{event_description}'")

    if not update_fields:
        return "No fields to update."

    print(f"Updating event {event_id} with: {', '.join(update_fields)}")
    return f"Event {event_id} updated successfully."

@tool
def delete_calendar_event(event_id: str):
    """Delete a calendar event by its ID."""
    # In a real implementation, you would connect to a calendar API
    # and delete the event with the given ID.
    print(f"Deleting event {event_id}")
    return f"Event {event_id} deleted successfully."
