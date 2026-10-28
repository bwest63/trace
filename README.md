# TRACE

**Training Readiness Assessment & Coaching Environment**: a shared workspace for OC/Ts to record T&EO performance-step observations, track coverage, and draft AARs.

**Prototype. Fictional data only.** Not an official Army system. Do not enter real unit readiness information, CUI, or classified data.

- **Live app:** https://tracedashboard.com
- **Setup and administration:** [SETUP.md](SETUP.md)
- **Database script:** [supabase/schema.sql](supabase/schema.sql), run in Supabase's SQL Editor (re-run after updates that change it)
- **Single-file, single-browser version:** [standalone/TRACE_v42.html](standalone/TRACE_v42.html)

## Formatted reports (EXSUM and FAAR)

On **AAR & Reports**, pick the training event and observed unit, then **Generate EXSUM (Word)** or **Generate FAAR (PowerPoint)**. TRACE compiles each OC/T's ODR findings, AAR development inputs, and GO / NO-GO step notes into sustain and improve paragraphs with recommendations, and fills them into the unit templates in `templates/`. Event details that evaluations don't hold (CTOs, key leaders, deliverables, signature block) are entered under **Report details**; admins' entries are shared with every OC/T.
