---
updated: 2026-11-02
by: Bay Door Technical & Safety Systems Architect
---

## Decided
- Architecture: Galvanically isolated 24VDC door controller auxiliary tap paired with a 2.5-second monostable pulse circuit.
- Compliance posture: Strictly additive warning under PUWER 1998 Reg 24 and IEC 60204-1; zero interference with interlock stop chains.
- Acoustic design: 2.5-second pulsed tone (swept 2.4 to 2.9 kHz, 102 dBA at 1m) to trigger orienting reflex and prevent sensory gating per ISO 7731.
- Total Bill of Materials engineered under GBP 50 using real, in-stock RS Components and Farnell catalog components (£39.65 single, £26.97 bulk).
- Interactive WebGL simulation implemented with Three.js via CDN for direct, zero-build browser demonstration.
- Visual aesthetic follows Anti-AI-Slop guidelines: warm dark codex palette (#14120f / #faf6ee), Fraunces and Space Mono typography, hairline rules.
- Strict constraint: Zero em dash characters throughout all code, schematics, and documentation.

## Open
- Controller-specific pinout standardization across Hormann WA400, Crawford 542, and GfA TS970 control boxes.
- Direct installer outreach to validate 40 percent margin expectation on routine maintenance invoices.

## Next
- Hand over verified repository to prototype-deployment-operator for web hosting or staging deployment.
- Prepare pilot demonstration kit for engagement with regional door service contractors.

## Landmines
- Wiring in series with door stop loops or photocells: breaks PUWER 1998 compliance and invalidates door manufacturer warranty.
- Continuous alarm tones: leads to 100 percent worker habituation within shifts; pulse duration must not exceed 3 seconds.
- Over-engineered cloud or micro-controller dependencies: industrial door maintenance engineers reject systems requiring software configuration.
