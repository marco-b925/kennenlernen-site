## Workflow: WhatsApp Chatbot mit RAG

- **Platform:** n8n (Self-Hosted oder Cloud)
- **Typ:** KI-Agent mit Knowledge-Base-Zugriff und Multi-Modal-Support

### Architektur

**Trigger:** WhatsApp Business API (Webhook)
→ eingehende Nachrichten (Text, Audio, Bild, Dokument)

**Pipeline pro Nachrichtentyp:**

| Typ | Verarbeitung |
|-----|-------------|
| Text | Direkt an Agent weitergeleitet |
| Audio/Sprachnachricht | Download → OpenAI Whisper Transkription → Text an Agent |
| Bild | Download → OpenAI GPT-4o-mini Vision Analyse → Beschreibung + Caption an Agent |
| PDF | Download → Extract from File (PDF-Parser) → Text-Extrakt an Agent |
| Excel (XLS/XLSX) | Download → Extract from File → JSON-Mapping → strukturierte Daten an Agent |
| JSON | Direkt an Agent |
| HTML/TXT/RTF/XML | Download → Mapping → Text an Agent |
| Kalender (.ics) | MIME-Type-Remapping → Text an Agent |

**Agent-Konfiguration:**
- **Model:** GPT-4o-mini
- **Tool:** MongoDB Vector Search (eigene Knowledge-Base-Abfrage, Tool-Name "productDocs")
- **Memory:** Buffer-Window mit Session-Key pro WhatsApp-User (`wa_id`-basiert)
- **System-Prompt:** via Chat-Model-Konfiguration

**Indizierung (manueller Workflow):**
1. Manueller Trigger ("Execute Workflow")
2. Google Docs Import (liest Produkt-Dokumentation)
3. OpenAI Embeddings (text-embedding-3-small, 1536 Dimensionen)
4. MongoDB Vector Store Insert (Collection `n8n-template`, Index `data_index`)
5. Metadata: `doc_id`-Feld fuer Dokument-Herkunft

**File-Routing:**
- Intelligentes MIME-Type-Matching (CSV, HTML, Calendar, RTF, TXT, XML, PDF, JSON, XLS, XLSX)
- Fallback fuer unbekannte Typen: "Unsupported file type"-Antwort
- Custom-Mapping fuer edge cases (calendar → mapped/calendar, xml → mapped/xml)

### Warum relevant
Zeigt tiefes Verstaendnis von KI-Agent-Architekturen, RAG-Pipelines und Multi-Modal-Verarbeitung. Der Workflow ist produktionsreif — kein Demo-Code, sondern eine echte Automatisierung die WhatsApp-to-Knowledge-Base-Chatting ermoeglicht.