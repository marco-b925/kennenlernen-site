## Workflow: AI Database Chat Agent

- **Platform:** n8n (Self-Hosted oder Cloud)
- **Typ:** SQL-Agent mit natural-language-to-SQL-Conversion

### Architektur

**Trigger:** Chat Message (n8n eingebauter Chat-Trigger)
→ User schreibt natuerlichsprachliche Frage ueber Datenbank

**Pipeline:**
1. **Chat Trigger** empfaengt Nachricht
2. **AI Agent** (GPT-4o-mini) interpretiert Frage
3. Agent generiert SQL-Statement ueber `$fromAI('sql_statement')`
4. **Postgres Tool** fuehrt Query aus (`executeQuery`)
5. Ergebnis wird in Chat zurueckgegeben

**Komponenten:**
- **Model:** GPT-4o-mini via OpenAI Chat Model Node
- **Tool:** Postgres (direkte Query-Execution, keine ORM)
- **Memory:** Buffer Window (Konversations-Kontext)
- **Prompt:** "Which tables are available?" als Beispiel-Query

### Flexibilitaet
- Postgres-Node ist austauschbar gegen MySQL, SQLite oder andere DB-Typen
- Agent kann komplexe Joins, Aggregationen und Subqueries generieren
- Memory verhindert redundante Queries in einer Session

### Warum relevant
Zeigt Kompetenz im Bereich Datenbank-Automatisierung und AI-to-SQL-Umsetzung. Der Agent macht aus natuerlicher Sprache produktive Datenbankabfragen — ein Pattern, das in vielen Business-Kontexten wertvoll ist (Reporting, Analytics, Data Exploration ohne SQL-Kenntnisse).