# Project Log: BayDoor Deterministic Blind-Bay Warning System

## 2026-11-02: Project Initiation and Technical Specification
- Synthesized raw research from Obsidian knowledge base (`Void/BUSINESS IDEAS/Bay Door Safety/`).
- Verified field observations from high-velocity logistics warehouse operations: drivers honk inconsistently before traversing blind door openings; relying on human compliance fails systematically.
- Confirmed technical premise: industrial door controllers (Hormann, Crawford, GfA, Alpro) universally provide 24VDC control circuits with auxiliary volt-free (dry contact) relay terminals.
- Resolved PUWER 1998 and IEC 60204-1 compliance: tap is strictly additive and parallel; no series intrusion into safety interlock chains; fails safe upon power loss.
- Solved alarm fatigue: replaced continuous buzzer models with an ISO 7731 compliant 2.5-second pulsed alert (orienting reflex vs sensory gating).
- Established sub-GBP 50 Bill of Materials with RS Components and Farnell catalog numbers.
- Initiated repository at `/Users/saicharan/Projects/baydoor-safety/`.

## 2026-11-02: Interactive Prototype Implementation and Verification
- Created index.html, style.css, and app.js implementing the full digital twin and circuit state machine.
- Implemented real-time Three.js 3D WebGL warehouse environment:
  - Procedural counterbalanced forklift with industrial orange chassis, ROPS cage, mast, forks, and rubber tires.
  - Pedestrian worker model with high-visibility safety vest and hard hat.
  - Warehouse partition wall, roller shutter guide rails, lintel, and 8-panel sectional door with lift mechanics.
  - Far-side RS PRO 235-9003 warning station with 3D pulsed point light, red beacon lens, and expanding acoustic wave indicators.
  - Obscured blind-corner volumetric sightline cone highlighting risk zone before threshold.
  - Camera angle switcher (Isometric, Pedestrian View, Driver View, Top Plan View).
- Built Web Audio API swept-frequency industrial sounder (2,400 Hz to 2,900 Hz modulated at 4 Hz) adhering to ISO 7731 acoustic danger signal standards.
- Designed responsive, interactive SVG circuit emulator demonstrating 24V controller auxiliary dry contact closure, 3.75kV optoisolator barrier conductivity, 2.5-second monostable RC pulse capacitor charge curve, and far-side strobe activation.
- Integrated comprehensive technical specifications, PUWER 1998 compliance brief, dynamic volume BOM calculator, and regional contractor channel economics model.
- Validated strict Anti-AI-Slop design guidelines: warm dark codex palette (#14120f base, #faf6ee ink), Fraunces and Space Mono typography, solid hairline 1px rules, zero gradients, zero radial glow orbs.
- Conducted automated python audit confirming zero em dash characters across all project files.
- Verified clean HTTP serving (HTTP 200) and node syntax check on JavaScript bundle.

## 2026-11-02: UX Refactor, Inbound Contact Capture & Smart Referrer Navigation

- Refactored user interface to eliminate heavy vertical scroll: implemented a 3-card executive summary strip (Hazard, Deterministic Interlock, Hardware Reality) and tucked in-depth engineering parameters, PUWER compliance memo, BOM table, contractor model, and controller pinouts into 5 collapsible details drawers.
- Added prominent Inbound Pilot & Inquiries Station with Sai Charan, London, UK, direct mailto action button, and GitHub repository links for traffic traction.
- Implemented smart referrer back-navigation: visitors from portfolios-chi-one.vercel.app dynamically receive a back navigation pill via referrer and ?ref=portfolio parameter.
- Deployed update to Vercel production at https://baydoor-safety.vercel.app (HTTP 200 confirmed).
- Updated canonical portfolio at https://portfolios-chi-one.vercel.app with ?ref=portfolio tracking.
- Codified non-negotiable contact and information architecture rules into prototype-deployment-operator and prototype-distribution-operator system instructions.
