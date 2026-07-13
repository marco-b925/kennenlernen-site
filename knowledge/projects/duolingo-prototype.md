## Projekt: Duolingo-Prototyp (Lingo-Fork)

- **Repo:** https://github.com/beyond925-de/duolingo-prototype
- **Live-Demo:** https://prototype-beyond925.netlify.app
- **Beschreibung:** Fork des Duolingo-Clones "Lingo" — rebranded als **TalentJourney – The Demo for your Job!**. Beweist, dass gamifizierte Lern-Erlebnisse auch fuer Recruiting funktionieren.

### Tech-Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, React 18, Tailwind CSS
- **Backend:** Next.js API Routes, Server Actions
- **Datenbank:** PostgreSQL via Neon DB (serverless), Drizzle ORM
- **Auth:** Clerk (social login, role-based access)
- **Payment:** Stripe (subscriptions, webhooks)
- **State:** Zustand
- **UI:** Radix UI, Lucide Icons, Sonner Toasts, React Circular Progressbar, React Confetti
- **Hosting:** Netlify

### Features
- **Lern-Pfad:** Kurse → Units → Lessons → Challenges (multiple choice, fill-in-blank, listening)
- **Gamification:** Hearts-System (5 Leben), XP-Punkte, Leaderboard, Quests (taeglich/wöchentlich)
- **Shop:** Items mit virtueller Waehrung kaufen (Herz-Refills, XP-Boosts)
- **Admin-Panel:** CRUD fuer Courses, Units, Lessons, Challenges, ChallengeOptions
- **Progress-Tracking:** User-Progress mit Completion-Percentage

### Was ich daran geaendert habe
- Branding komplett auf Beyond925/TalentJourney umgestellt
- Custom Domain + Netlify-Deployment
- Admin-Konfiguration auf eigene Clerk-User gesetzt
- Text-Inhalte auf Recruiting-Kontext adaptiert

### Warum relevant fuer diese Bewerbung
Zeigt Kompetenz im Bereich Full-Stack-Entwicklung, Gamification, Third-Party-API-Integration (Clerk, Stripe, Neon) und schnellem Prototyping. Das Projekt beweist, dass ich komplexe Open-Source-Codebases verstehen, anpassen und produktiv deployen kann.