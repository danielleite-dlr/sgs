# Features Research: SGS Beauty Salon SaaS

**Domain:** Beauty salon / barbershop / aesthetic clinic management SaaS
**Market:** Brazil (salões de beleza, barbearias, clínicas estéticas, nail designers, estúdios de noivas)
**Researched:** 2026-05-02
**Confidence:** HIGH (table stakes, Brazilian market) / MEDIUM (competitor gaps — web tools unavailable during research session)

> **Research note:** WebSearch and WebFetch were unavailable during this session (plan mode). Analysis draws on training knowledge through August 2025 covering: Trinks, Fresha, Booksy, Mindbody, Vagaro, GetNinjas, iSalon, and Brazilian market dynamics. Table stakes and Brazilian-specific findings are HIGH confidence. Exact competitor feature-by-feature mapping is MEDIUM confidence — validate against live competitor sites before roadmap finalization.

---

## Table Stakes
(Must have — users leave without these or don't adopt in the first place)

### Scheduling & Calendar

- **Visual calendar / agenda** — Day/week view by professional or resource, drag-to-reschedule, color-coded by service or professional | Complexity: Med
- **Multi-professional scheduling** — Each professional has their own column/lane; system prevents double-booking | Complexity: Med
- **Configurable time slots** — 15/20/30/45/60 min intervals to match service duration reality | Complexity: Low
- **Block times / unavailability** — Mark breaks, lunch, holidays, personal time per professional | Complexity: Low
- **Quick appointment creation** — Pick date/time + professional + service(s) + client in under 3 taps | Complexity: Low
- **Walk-in support** — Add same-day appointment without pre-booking | Complexity: Low
- **Appointment status workflow** — Agendado → Confirmado → Em atendimento → Concluído → Não compareceu | Complexity: Low
- **Recurring appointments** — For regular clients (weekly blowout, monthly coloring) | Complexity: Med

### Client Management

- **Client profile / ficha de cliente** — Name, phone, email, CPF, birthday, notes, photos, service history | Complexity: Low
- **Client search** — Find by name, phone, or CPF quickly from any screen | Complexity: Low
- **Service history per client** — What services, when, by whom, at what price | Complexity: Low
- **Birthday tracking** — Alert or auto-campaign on client birthday | Complexity: Low
- **Client notes / observations** — Allergies, preferences, hair type, skin concerns | Complexity: Low
- **Anamnese / intake forms** — Health questionnaire for aesthetic procedures (required for clinics) | Complexity: Med

### Service & Product Catalog

- **Service catalog with pricing** — Categories → services → durations → prices | Complexity: Low
- **Multiple prices per service** — Short/medium/long hair pricing tiers per service | Complexity: Med
- **Service packages / combos** — Bundle 2+ services at a combined price | Complexity: Med
- **Product catalog with stock** — Track shampoos, treatments, retail products with quantities | Complexity: Med
- **Stock alerts** — Low-stock notification for consumables and retail products | Complexity: Low

### Point of Sale / Checkout

- **Service order (comanda)** — Open tab per appointment, add services and products | Complexity: Med
- **Multiple payment methods in one transaction** — Partial Pix + partial cash, partial card split | Complexity: Med
- **Pix integration** — Generate QR code or copia-e-cola string, webhook confirmation | Complexity: Med
- **Cash, card, transfer support** — Basic payment types every salon already accepts | Complexity: Low
- **Discount application** — Fixed or percentage discount per item or on total | Complexity: Low
- **Receipt / comprovante generation** — Printable or shareable receipt after checkout | Complexity: Low
- **Cash register (caixa)** — Opening balance, close with discrepancy tracking | Complexity: Med

### Commission Calculation

- **Commission per service/product** — Each professional earns % or fixed value per item | Complexity: Med
- **Commission by professional profile** — Different professionals can have different commission tiers | Complexity: Med
- **Commission report** — Period summary per professional (what they earned) | Complexity: Low

### Financial Dashboard

- **Daily/weekly/monthly revenue summary** — Total income, breakdown by service category and payment method | Complexity: Med
- **Expenses tracking** — Record rent, supply costs, fixed costs | Complexity: Low
- **Profit overview** — Revenue minus expenses at a glance | Complexity: Low

### Online Booking / Public Link

- **Public booking page** — Link the salon shares on WhatsApp, Instagram bio, Google Business | Complexity: Med
- **Service + professional selection** — Client picks what they want and with whom | Complexity: Med
- **Available slot display** — Only shows genuinely free times per professional | Complexity: Med
- **Booking confirmation flow** — Confirmation screen + WhatsApp confirmation message | Complexity: Med

### Automated Reminders

- **WhatsApp reminder 24h before** — Single most impactful no-show reducer in Brazil | Complexity: Med
- **Appointment confirmation request** — Client confirms via WhatsApp reply or link | Complexity: Med
- **No-show follow-up** — Auto message after a no-show to reschedule | Complexity: Med

### User Management & Access Control

- **Role-based access** — Owner, manager, receptionist, professional — each sees what is relevant | Complexity: Med
- **Professional login** — Each professional sees their own agenda and commission totals | Complexity: Low
- **Owner dashboard** — Full access across all professionals and financials | Complexity: Low

---

## Differentiators
(Competitive advantage — what separates SGS from Trinks, Fresha, Booksy)

### Wedding & Event Studio (Estúdio de Noivas)

- **Wedding group management** — One booking event for bride + N bridesmaids, all services mapped to the same day/time | Why it differentiates: Trinks and Fresha have no dedicated wedding group flow; it is the highest-ticket vertical in Brazilian beauty with zero dedicated SaaS tooling
- **Event timeline / planner** — Schedule the morning-of sequence: hair 08h, makeup 09h30, nails 07h, etc. | Why it differentiates: Replaces WhatsApp groups + paper checklists used universally today
- **Deposit / sinal per event group** — Capture partial payment at booking to reduce no-shows for high-value events | Why it differentiates: Event-specific deposit handling beyond regular appointment deposits
- **Digital contract with installments** — Contract PDF with e-signature link, payment schedule per milestone | Why it differentiates: No competitor has native event contracts + installment tracking; salons use Word + WhatsApp today
- **AI-assisted wedding scheduling** — Suggest optimal professional assignment for a group given service durations and total available time | Why it differentiates: First-party AI scheduling for events is not a feature in any current Brazilian competitor

### WhatsApp-First Communication

- **WhatsApp API integration (official)** — Send via official Business API for deliverability and compliance | Why it differentiates: Fresha and Booksy use SMS/email; WhatsApp has ~98% open rate in Brazil vs ~20% for email
- **Two-way WhatsApp confirmation** — Client replies "1 confirmar / 2 cancelar" and system auto-updates booking status | Why it differentiates: Most competitors send one-way notifications; two-way closes the loop automatically
- **Segmented campaign messaging** — Birthday, win-back (60+ days no visit), seasonal (Carnaval, Dia das Mães, Black Friday) | Why it differentiates: Booksy/Fresha have basic reminders but no segmented campaign builder targeting Brazilian calendar
- **WhatsApp booking intake** — Client initiates booking via chatbot flow | Why it differentiates: Reduces friction to zero for Brazil's WhatsApp-native demographic

### AI-Powered Operations

- **Demand forecasting** — Predict busy periods using historical booking data + seasonality | Why it differentiates: No local Brazilian competitor has this; enables proactive staff scheduling
- **Operational alerts** — "Professional X has 3 gaps tomorrow — trigger a fill campaign?" | Why it differentiates: Actionable intelligence vs. static reports
- **Service recommendation** — "It has been 6 weeks since this client's last color — suggest rebooking?" | Why it differentiates: Drives retention and revenue per client passively

### Client Retention Intelligence

- **At-risk client detection** — Flag clients who have not returned in N weeks (configurable per service type) | Why it differentiates: Trinks/Booksy show visit history but have no proactive churn detection
- **Client lifetime value (LTV) tracking** — Total spend per client over their history with the salon | Why it differentiates: Shifts owner mindset from transactional to relationship-based
- **Segmented client lists** — High-value clients, inactive clients, birthday this month — for targeted campaigns | Why it differentiates: Replaces external email marketing tools the salon would otherwise pay separately for

### Flexible Pricing

- **Dynamic pricing by professional seniority** — Junior stylist charges less than senior for the same service | Why it differentiates: A real-world scenario most platforms handle awkwardly by forcing a single price per service
- **Promotional pricing / time-limited offers** — "Tuesday discount — 20% off color until 18h" to fill slow periods | Why it differentiates: Fills idle professional time without requiring manual catalog edits

### Professional Experience

- **Professional-facing "my day" view** — Clean view showing only their appointments, no owner financials | Why it differentiates: Trinks forces all users into the same UI; professionals want simplicity
- **Commission transparency in real time** — Professional sees their own earnings as each comanda closes | Why it differentiates: Reduces commission disputes, a major pain point causing stylist turnover in Brazilian salons

### Aesthetic Clinic Specifics

- **LGPD-compliant anamnese storage** — Encrypted storage of medical intake forms with client consent timestamp | Why it differentiates: Regulatory requirement for clínicas; competitors handle this poorly or not at all
- **Before/after photo gallery per client** — Visual treatment progress tracking per session | Why it differentiates: Standard expectation in medical aesthetics; no Brazilian beauty SaaS has this natively
- **Treatment protocol tracking** — Multi-session protocols (e.g. 10 laser sessions) with progress per session | Why it differentiates: Clinics sell packages that need session-level tracking; most platforms only handle single appointments

---

## Anti-Features
(Things to deliberately NOT build in v1 — defer until market validation)

- **Native mobile app (iOS/Android)** — PWA covers 80% of use case at a fraction of the build cost; native app is 6+ months of parallel investment for marginal v1 gain. Defer to Phase 5 as per PROJECT.md
- **Multi-unit / franchise management** — Adds enormous complexity to RLS model, reporting, and commission structures. Single-unit MVP is the right scope; expand in Phase 5+
- **Full NF-e / NFS-e fiscal integration** — Fiscal stack in Brazil is a full product (every município has different NFS-e rules). Phase 4 scope; v1 receipts are sufficient for most salons
- **Marketplace / professional discovery** — "Find a salon near me" is a different business model (GetNinjas territory) not a management tool feature
- **Payroll / folha de pagamento** — Full DP integration (eSocial, FGTS, INSS) is accounting software territory; integrate with third-party contabilidade later
- **Inventory supplier ordering** — Sending purchase orders to beauty supply distributors requires supplier-specific integrations; not core to management
- **Video consultation / teleconsulta** — Aesthetic clinics occasionally do teleconsultas but this is out of scope for a scheduling-focused MVP
- **Loyalty points program** — Gamified loyalty (stamps, points, rewards) adds product complexity and client-facing app surface. Phase 3 candidate
- **Public review / rating system** — Requires moderation workflow, reputation management edge cases; adds risk for small salons. Fresha has it; SGS does not need it in v1
- **Custom branded app per salon** — White-label mobile app per tenant is technically heavy with small customer benefit at MVP scale
- **Accounting / contabilidade integration** — ContaAzul, QuickBooks etc. — complex, small % of salons need it in v1
- **Employee shift / rota scheduling** — Shift planning beyond appointment blocking is HR software territory
- **Google/iCal calendar sync** — Useful but not critical for MVP; Phase 5 per PROJECT.md
- **REST API (public)** — GraphQL-first as decided in PROJECT.md; REST only if demand appears

---

## Brazilian Market Specifics

- **Pix as primary payment method** — Brazil's instant payment system (Banco Central) is now the #1 payment method for services. Generating Pix QR codes or copia-e-cola strings at checkout is not optional. Must integrate with a gateway supporting Pix: Pagar.me, Gerencianet/Efí, Asaas, or MercadoPago. Complexity: Med
- **WhatsApp as primary communication channel** — Brazil has 147M+ WhatsApp users. SMS and email have near-zero open rates for service reminders. Any reminder or marketing without WhatsApp is functionally invisible. Official Meta Business API required for scale; Z-API / WPPConnect viable for MVP phase (unofficial but widely used in Brazil). Complexity: Med–High
- **CPF as client identifier** — Brazilians are identified by CPF (Cadastro de Pessoas Físicas). Salon clients expect registration and lookup by CPF. Also needed for NFe in Phase 4. Complexity: Low
- **LGPD compliance (Lei 13.709/2018)** — Brazil's GDPR equivalent. Mandatory for any SaaS handling personal data. Specific requirements: consent logging for anamnese, right-to-erasure workflow, data minimization, DPA appointment. ANPD fines up to 2% of revenue capped at R$ 50M per violation. Complexity: Med
- **NF-e / NFS-e fiscal notes** — Brazilian law requires electronic invoices for services above thresholds. NF-e is federal (products); NFS-e is municipal (services — each município has different rules and XML schemas). Phase 4 scope but architecture must store: CNPJ, CPF, service description, fiscal code (CNAE), value. Complexity: High (emission) / Low (data storage now)
- **Brazilian calendar / seasonality** — Carnaval (Feb), Dia das Mães (May), Festa Junina, Dia dos Namorados (Jun), Black Friday (Nov), Réveillon — each is a major salon revenue spike. Campaign templates must reflect this calendar specifically. Complexity: Low (content) / Med (scheduling engine for seasonal campaigns)
- **Split payment / repasse** — When platform charges a SaaS fee + enables commission auto-transfer to professionals, a payment gateway split (Pagar.me subaccounts or Stripe Connect equivalent) is needed. Phase 3+ feature but architecture must not block it. Complexity: High
- **PIX recebível webhook tracking** — When a client pays a deposit via Pix for an event, the platform must receive the payment webhook and auto-mark the comanda as partially paid. Requires gateway webhook integration. Complexity: Med
- **WhatsApp opt-in / LGPD intersection** — Sending marketing messages on WhatsApp requires explicit client opt-in per LGPD + Meta Business Policy. Platform must store consent timestamp per client per communication channel. Complexity: Med
- **Regime tributário awareness** — MEI, Simples Nacional, Lucro Presumido affect how commission and service values are taxed. Platform does not need to calculate taxes but must store regime for Phase 4 fiscal integration. Complexity: Low (storage) / High (calculation — defer)
- **Portuguese-only UI** — All copy, labels, error messages, and help documentation in Brazilian Portuguese. Localization architecture must support future languages but pt-BR is the only locale for v1. Complexity: Low

---

## Competitor Gaps
(What competitors are missing — opportunity areas for SGS)

### Trinks (Brazilian incumbent, dominant in salões)
- Strong on scheduling and POS but UI is dated and notoriously slow on mobile
- No native WhatsApp 2-way confirmation (sends messages but does not parse replies)
- No wedding/event group management
- Commission module is inflexible (fixed % only, no tiered or per-item override)
- No AI features of any kind
- No LGPD-compliant anamnese storage — clinics are underserved
- No at-risk client detection or LTV tracking

### Fresha (global, strong in São Paulo / Rio upper-market)
- Freemium model with 20% commission on Fresha-sourced bookings creates significant resentment at scale
- No WhatsApp integration (uses email + in-app push — low open rates in Brazil)
- No native Pix support (requires workarounds)
- Strong marketplace discovery feature but weak management depth
- No Brazilian seasonal campaign builder
- No wedding event management
- LGPD compliance is surface-level at best

### Booksy (Polish origin, dominant in Brazilian barbershop segment)
- Strong for barbershops, weak for full-service salons and clinics
- No multi-service group booking (weddings / events)
- WhatsApp integration is basic (outbound only, no 2-way)
- Strong client reviews/ratings but this creates moderation burden
- No AI features
- Per-professional seat pricing becomes expensive for larger salons

### Mindbody (US-centric, high-end spa / fitness crossover)
- Too expensive and complex for the typical Brazilian salão de bairro
- No Pix support
- No WhatsApp integration
- No real Portuguese localization
- Overkill for SMB beauty segment in Brazil

### Vagaro (US-origin)
- Not meaningfully present in Brazil
- No Pix, no WhatsApp, no Portuguese
- Not a real competitive threat in the Brazilian market

### GetNinjas / Marketplace players
- Lead-gen marketplaces, not management tools
- Salons using GetNinjas still need a separate management system
- Opportunity: capture these users who need management depth beyond lead generation

### White Spaces (High Opportunity)

1. **Wedding studio management** — Zero dedicated SaaS tooling in Brazil. Salons use WhatsApp groups + paper. High average ticket (R$ 3.000–15.000 per event), high loyalty, strong word-of-mouth. First mover captures a high-LTV vertical.
2. **AI demand forecasting + gap-filling campaigns** — No Brazilian competitor has predictive demand or automated "fill my empty slots" campaigns. Directly reduces revenue loss from no-shows and idle professionals.
3. **Aesthetic clinic compliance stack** — LGPD-compliant anamnese + before/after photos + multi-session protocol tracking. Dermatologists and aestheticians are materially underserved. High willingness to pay.
4. **2-way WhatsApp confirmation with automatic booking sync** — Confirmation → auto status change in calendar is a straightforward integration that no Brazilian player has completed cleanly.
5. **Commission transparency for professionals** — Real-time visibility for professionals reduces stylist turnover, which is a major pain for salon owners. No competitor surfaces this to the professional tier.

---

## Feature Dependencies

```
Client Profile → Service History
Client Profile → Anamnese (clinics)
Client Profile + LGPD Consent → Campaign Messaging
Service Catalog → Appointment Creation
Appointment Creation → Comanda / POS
Comanda / POS → Commission Calculation
Comanda / POS → Pix Payment Integration
Cash Register (Caixa) → Comanda / POS
Commission Calculation → Commission Report
Online Booking Link → Service Catalog
Online Booking Link → Appointment Creation
WhatsApp Reminder → Appointment Creation
WhatsApp 2-way Confirmation → WhatsApp Reminder (extends it)
Campaign Builder → Client Segmentation
Client Segmentation → Client Profile + Service History
At-risk Detection → Service History + configurable return window
Wedding Group → Appointment Creation (multi-client extension)
Wedding Group → Digital Contract
Digital Contract → Pix deposit / installment payment
AI Scheduling Suggestions → Wedding Group + Service Catalog + Professional Availability
Demand Forecasting → Historical booking data (needs 3+ months minimum)
NF-e / NFS-e (Phase 4) → Client CPF + CNPJ + Service Catalog with fiscal codes
```

---

## MVP Recommendation

**Prioritize for v1 (must ship to acquire first paying customer):**
1. Visual calendar + multi-professional scheduling
2. Client profiles with CPF and service history
3. Service catalog with pricing tiers
4. Comanda / POS with Pix + cash + card
5. Commission calculation per service
6. WhatsApp reminder (24h before)
7. Public booking link
8. Basic financial dashboard (daily revenue)
9. Role-based access (owner, professional)
10. LGPD consent tracking on client creation and anamnese

**Ship in v1 as differentiator (drives acquisition, not just retention):**
- Wedding group booking + event timeline (unique, high-ticket vertical)
- WhatsApp 2-way confirmation (closes the loop competitors leave open)
- At-risk client detection + birthday campaign (drives immediate perceived value for owners)

**Defer with clear rationale:**
- NFe/NFSe: Phase 4 — needs fiscal stack, too complex for MVP, not blocking for most salons
- Multi-unit: Phase 5 — adds significant architectural complexity to RLS and reporting
- Native mobile app: Phase 5 — PWA sufficient for launch
- Loyalty points: Phase 3 — nice-to-have, not an adoption driver
- Marketplace / discovery: Phase 5+ — different business model, different GTM

---

## Summary

1. **Pix + WhatsApp are non-negotiable table stakes in Brazil** — any platform without both is dead on arrival for the target market. These are not differentiators; they are entry tickets. Every other feature is secondary.

2. **Wedding / bridal studio management is an unoccupied niche** with zero dedicated SaaS tooling in Brazil, high average ticket value (R$ 3k–15k per event), and strong word-of-mouth dynamics. Building this correctly from Phase 1 gives SGS a defensible vertical that Trinks, Fresha, and Booksy cannot easily copy without a full rewrite of their booking models.

3. **Trinks is the incumbent to displace** — it dominates the Brazilian market but has a dated UX, no AI, no 2-way WhatsApp, inflexible commissions, and no clinic-specific features. It is beatable on product quality, vertical depth, and modern UX.

4. **AI features are a genuine differentiator in 2025–2026** — demand forecasting, gap-filling campaigns, and event scheduling assistance are not offered by any Brazilian competitor. Implementation via Claude API is feasible from Phase 1 given the existing PROJECT.md architecture decisions.

5. **LGPD compliance is a forcing function and a competitive moat for clínicas estéticas** — clinics face real fines without proper anamnese consent and storage. Building LGPD compliance correctly (encrypted, auditable, with erasure workflows) from Day 1 opens the aesthetic clinic vertical that competitors have neglected, at a willingness-to-pay premium.
