# MOVI: The Next-Generation Multimodal Transport Agent
## Enterprise Architecture & Implementation Documentation

**Project Status**: Production Prototype
**Version**: 1.0.0

---

## 1. Executive Summary

MoveInSync Shuttle Operations require a sophisticated, fault-tolerant control system. **Movi** represents a paradigm shift from static CRUD interfaces to a **Knowledge-Aware, Multimodal AI Agent** capable of orchestrating complex logistics workflows.

This system solves the "Tribal Knowledge" problem in transport operations—where junior managers inadvertently break downstream dependencies (e.g., modifying a Route that invalidates generated Trip Sheets). Movi introduces a **Stateful Logic Layer** that proactively models consequences before execution, serving as an automated operational safeguard.

The platform unifies **Voice (WebRTC/SIP)**, **Vision (Computer Vision)**, and **Text (LLM)** interfaces into a single cohesive control plane, enabling transport managers to operate hands-free or via rapid visual troubleshooting.

---

## 2. System Architecture

The Movi platform is built on a **Microservices-based Event-Driven Architecture**, separating the Real-time Voice capabilities from the core Business Logic and Frontend presentation layers.

### 2.1 High-Level Design (HLD)

The system comprises three primary subsystems:
1.  **The Context Layer (Frontend)**: A Next.js 14 application providing the visual surface for managing Stops, Routes, and Dashboard Operations.
2.  **The Intelligence Core (Backend)**: A FastAPI/LangGraph orchestration engine that maintains state, executes tools, and guards data integrity.
3.  **The Voice Gateway (Real-Time Worker)**: A standalone Python worker process utilizing LiveKit to bridge SIP/WebRTC audio streams with high-performance AI models.

### 2.2 The Voice Agent Stack (Latency-Optimized)

The voice architecture is designed for **sub-500ms latency** conversational turns, utilizing best-in-class specific models rather than a generic monolith.

*   **Transport Layer**: **LiveKit** (WebRTC SFU) handles real-time audio streaming, jitter buffering, and connection management.
*   **Voice Activity Detection (VAD)**: **Silero VAD** provides edge-based silence detection to handle interruptions and turn-taking naturally.
*   **Speech-to-Text (STT)**: **Deepgram Nova-2**. Selected for its superior speed and accuracy in Indian accent recognition compared to standard Whisper models.
*   **Large Language Model (LLM)**: **OpenAI GPT-4o-mini**. Fine-tuned via system prompts for JSON-tool calling and strict adherence to transport ontology.
*   **Text-to-Speech (TTS)**: **ElevenLabs Turbo v2.5**. Provides low-latency, emotionally expressive voice synthesis ("Sarah" model) to maintain user engagement.

### 2.3 The Cognitive Layer (LangGraph)

Unlike stateless chatbots, Movi uses **LangGraph** to model the Transport Manager's workflow as a finite state machine.

**Graph Nodes:**
1.  **`agent_node`**: The primary reasoning engine. Decides whether to call a tool, answer a query, or ask for clarification.
2.  **`check_consequences_node`**: **The Critical Safety Valve**. Before any WRITE operation (CREATE/UPDATE/DELETE), this node intercepts the action.
    *   *Logic*: `IF action == 'remove_vehicle' AND trip_bookings > 0% THEN status = 'HIGH_RISK'`
3.  **`ask_confirmation_node`**: If risk is HIGH, the graph transitions here, forcing a "Human-in-the-loop" verification step.

---

## 3. Data Architecture (Low-Level Design)

The database schema is normalized to enforce the strict operational dependencies of the Shuttle domain.

### 3.1 Layer 1: Static Assets (Network Definition)

*   **`stops` Table**
    *   `stop_id` (UUID): Primary Key.
    *   `name` (VARCHAR): Geolocated name (e.g., "Silk Board Junction").
    *   `latitude` (FLOAT8), `longitude` (FLOAT8).

*   **`paths` Table**
    *   `path_id` (UUID): Primary Key.
    *   `path_name` (VARCHAR): Logical identifier (e.g., "Morning-Route-A").
    *   `ordered_list_of_stop_ids` (JSONB): An array of `stop_id`s defining the sequence.

*   **`routes` Table** (The Product Definition)
    *   `route_id` (UUID): Primary Key.
    *   `path_id` (UUID): Foreign Key -> `paths`.
    *   `shift_time` (TIME): The scheduled start time.
    *   `direction` (ENUM): 'IN' (Home to Office) or 'OUT' (Office to Home).
    *   `status` (VARCHAR): Lifecycle state ('active', 'inactive').

### 3.2 Layer 2: Dynamic Operations (Daily Execution)

*   **`daily_trips` Table** (The Instance)
    *   `trip_id` (UUID): Primary Key.
    *   `route_id` (UUID): Foreign Key -> `routes`.
    *   `display_name` (VARCHAR): Generated nomenclature (e.g., "Bulk - 08:00").
    *   `booking_status_percentage` (INT): Real-time occupancy metric.
    *   `live_status` (VARCHAR): State machine ('Scheduled', 'Boarding', 'In-Transit', 'Completed').

*   **`deployments` Table** (Resource Allocation)
    *   `deployment_id` (UUID): Primary Key.
    *   `trip_id` (UUID): Foreign Key -> `daily_trips`.
    *   `vehicle_id` (VARCHAR): Foreign Key -> `vehicles` (License Plate).
    *   `driver_id` (UUID): Foreign Key -> `drivers`.

---

## 4. Implementation Details

### 4.1 Vision-to-Action Pipeline
Movi implements a **Multimodal RAG** pattern for image processing:
1.  User uploads dashboard screenshot via UI.
2.  Backend forwards image + context to **GPT-4o Vision**.
3.  Vision Model extracts semantic intent (e.g., "User is pointing at the delayed trip ID 102").
4.  Intent is converted to a structured command.
5.  LangGraph executes the command as if spoken by the user.

### 4.2 "Tribal Knowledge" Safeguards
The system enforces operational constraints that are usually documented only in human training manuals.
*   **Constraint**: "Never remove a vehicle from a trip if employees have already boarded or booked."
*   **Implementation**: The `check_consequences` graph edge queries `booking_status_percentage`. If `> 0`, it triggers a mandatory `Interrupt` event, returning a `ConsequenceWarning` payload to the UI.

---

## 5. Deployment & Configuration

### Prerequisites
*   **Python 3.9+**: For Backend and Worker.
*   **Node.js 18+**: For Next.js Frontend.
*   **Supabase Project**: PostgreSQL + Vector.
*   **API Keys**: OpenAI, Deepgram, ElevenLabs, LiveKit Cloud.

### Environment Setup
Configure the `.env` file with the following providers:

```bash
# Core AI
OPENAI_API_KEY=sk-...

# Database
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
DB_URI=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres

# Real-Time Voice Infrastructure
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_URL=<wss-url>

# Cognitive Voice Services
DEEPGRAM_API_KEY=<deepgram-key>
ELEVENLABS_API_KEY=<elevenlabs-key>
```

### Execution Strategy

**1. Start the Orchestration Backend (FastAPI)**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**2. Start the Voice Worker (Python/LiveKit)**
This process connects to the LiveKit websocket and awaits room connections.
```bash
python app/agent/worker.py
```

**3. Start the Frontend Console (Next.js)**
```bash
cd movi-frontend
npm run dev
```

---

## 6. Testing & User Interaction Guide

### 6.1 Text Chat Interface (Movi Widget)

The Movi Chat Widget is available on both the `busDashboard` and `manageRoute` pages. Click the "Ask Movi" floating action button in the bottom-right corner to open the chat interface.

#### Test Prompts for Dashboard Operations

**Query Operations (Read-Only):**
```
"List all trips scheduled for today"
"How many vehicles are currently unassigned?"
"What is the status of the trip 'Bulk - 00:01'?"
"Show me all routes that use Path-1"
"Which trips have bookings above 50%?"
"List all stops for Path-2"
```

**Create Operations:**
```
"Create a new stop called 'Odeon Circle' at latitude 12.9716 and longitude 77.5946"
"Create a path called 'Tech-Loop' using stops [Gavipuram, Temple, Peenya]"
"Create a new route for Path-2 at 19:45 in the Outbound direction"
"Add a new driver named 'Rajesh Kumar' with phone number '+91-9876543210'"
```

**Assignment Operations:**
```
"Assign vehicle 'MH-12-3456' and driver 'Amit' to the trip 'Bulk - 00:01'"
"Show me all available buses that can be assigned"
```

**Dangerous Operations (Will Trigger Consequence Check):**
```
"Remove the vehicle from 'Bulk - 00:01'"
"Delete the trip 'Morning Express'"
```

*Note: If the trip has bookings, Movi will intercept and ask for explicit confirmation before proceeding.*

#### Test Prompts for Route Management

**Static Asset Queries:**
```
"List all active routes"
"Show me all paths in the system"
"What stops are included in Path-1?"
"Which routes are scheduled for the morning shift?"
```

**Route Creation Workflow:**
```
"Create a new stop called 'Silk Board Junction'"
"Create a path 'North-Link' with stops [Stop-A, Stop-B, Stop-C]"
"Create a route for 'North-Link' at 08:00 AM in the Inbound direction"
```

### 6.2 Voice Chat Interface

Navigate to the "Voice Chat" page from the sidebar to access the real-time voice interface powered by LiveKit, Deepgram, and ElevenLabs.

#### Voice Test Scenarios

**Natural Language Queries:**
```
"Hey Movi, can you tell me how many trips we have scheduled for today?"
"What's the status of all our active vehicles?"
"Do we have any buses available right now?"
"Show me the schedule for the morning routes"
```

**Voice Commands:**
```
"Assign a bus to the 8 AM Tech Park route"
"List all stops for the North-Link path"
"Create a new stop called Central Station"
"What trips are currently in transit?"
```

**Interactive Conversations:**
```
User: "How many vehicles are free?"
Movi: "I found 3 unassigned vehicles. Would you like me to list them?"

User: "Yes, show me the details"
Movi: "Here are the available vehicles: [Lists vehicles with license plates and capacity]"
```

### 6.3 Image Analysis (Multimodal Input)

The chat widget supports image uploads for visual troubleshooting and rapid issue identification.

#### Image Test Scenarios

**Screenshot Analysis:**
1. Take a screenshot of the busDashboard showing a trip with a red alert indicator.
2. Click the image icon in the chat widget.
3. Upload the screenshot.
4. Type: "What's wrong with this trip?"
5. Movi will use GPT-4o Vision to analyze the image and identify the issue.

**Visual Command Execution:**
1. Upload a screenshot of a specific trip row.
2. Type: "Remove the vehicle from this trip"
3. Movi will extract the trip identifier from the image and execute the command (with consequence checks if applicable).

**Dashboard Context Understanding:**
1. Upload a screenshot of the manageRoute page.
2. Ask: "Help me create a new route based on what you see here"
3. Movi will analyze the existing route structure and guide you through creation.

### 6.4 Testing the "Tribal Knowledge" Flow

This is the critical safety feature that prevents operational errors.

**Test Scenario 1: Safe Removal**
1. Find a trip with 0% bookings (or create one via the UI).
2. In chat, type: "Remove the vehicle from [Trip Name]"
3. Expected: Movi executes immediately without warnings.

**Test Scenario 2: High-Risk Removal**
1. Find a trip with bookings > 0% (e.g., 25% booked).
2. In chat, type: "Remove the vehicle from [Trip Name]"
3. Expected: Movi intercepts and responds:
   ```
   "⚠️ WAIT! This trip is 25% booked. Removing the vehicle will cancel these bookings and a trip-sheet will fail to generate. Do you want to proceed?"
   ```
4. Type "Yes" to confirm or "No" to cancel.
5. If confirmed, Movi executes the removal.

**Test Scenario 3: Context-Aware Help**
1. Navigate to the `manageRoute` page.
2. Open Movi chat widget.
3. Type: "Help me create a new route"
4. Expected: Movi provides guidance specific to route management, understanding you're on the route management page.

### 6.5 Advanced Testing Scenarios

**Multi-Step Workflow:**
```
User: "I need to set up a new morning route"
Movi: "I can help with that. First, let's create the stops. What's the first stop name?"
User: "Tech Park Entrance"
Movi: "Created stop 'Tech Park Entrance'. What's the next stop?"
[... continues through path creation, route creation, and trip assignment]
```

**Error Handling:**
```
User: "Remove vehicle from trip that doesn't exist"
Movi: "I couldn't find a trip with that name. Let me list today's trips for you..."
```

**Knowledge Base Queries:**
```
"How do I deactivate a route?"
"What happens when I remove a vehicle from a trip?"
"Explain the difference between a path and a route"
```

---

## 7. Future Roadmap

1.  **Predictive Fleet Sizing**: Integrating Prophet models to forecast demand based on historical `daily_trips` data.
2.  **Driver Voice Assistant**: Extending the LiveKit worker to a mobile app for drivers to report breakdowns via voice.
3.  **WhatsApp Integration**: Bridging the LangGraph agent to WhatsApp Business API for automated driver coordination.

---



