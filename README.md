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

## 6. Future Roadmap

1.  **Predictive Fleet Sizing**: Integrating Prophet models to forecast demand based on historical `daily_trips` data.
2.  **Driver Voice Assistant**: Extending the LiveKit worker to a mobile app for drivers to report breakdowns via voice.
3.  **WhatsApp Integration**: Bridging the LangGraph agent to WhatsApp Business API for automated driver coordination.

---



