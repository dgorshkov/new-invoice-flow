# Finom Invoice Builder — Prototype Context

> This document captures the full product requirements, design decisions, technical architecture, and known gaps developed across ~6 iterations of a working React prototype. It is intended as context for Claude Code or any agent continuing this work.

## What This Is

A prototype invoice creation flow for **Finom**, a European fintech serving SMEs. Finom holds an EMI license and operates its own banking infrastructure. The target user is an **SME CEO who handles admin tasks (including invoicing) but cannot delegate them** — they are reluctant administrators, not finance professionals.

The prototype is a single-file React component (`invoice-builder.jsx`) that renders in Claude.ai's artifact viewer. It calls the Anthropic API directly for VAT classification. It covers 7 EU markets.

---

## Layout & Navigation

- **Split-screen**: wizard panel left (540px), live A4 PDF preview right
- **Vertical accordion stepper** (Apple.com checkout style, not horizontal progress bar)
- Steps 0–1 are collapsible (user may not touch them often). Steps 2–4 are always-visible sections.
- Preview scales responsively via `ResizeObserver`. On narrow viewports, layout stacks vertically.
- Finom brand colors extracted from their website. Primary pink `#FE42B4`, blue `#4A74FF`, dark `#242424`. Full WCAG AA compliant palette defined in the `C` object.

## Steps

### Step 0 — Invoice Branding
- Interactive but **non-functional** placeholder (logo upload, display name, accent color picker)
- Changes do not affect the preview yet. This is acknowledged in the UI.

### Step 1 — Your Business (Seller)
- Country selector: DE, FR, IT, ES, NL, BE, FI (all 7 Finom markets)
- 8 fields: registered name, trade name, street, postal/city, VAT ID, local tax ID, email, phone
- Pre-filled with a German mock seller
- **Small business exemption toggle** per country (Kleinunternehmer, Franchise en base, Forfettario, KOR, etc.) with real thresholds and legal mention text
- Spain has no exemption scheme — this is shown explicitly with a red notice
- Tax ID labels and placeholders are country-specific (Steuernummer, SIRET, Codice Fiscale, CIF/NIF, KVK, BCE/KBO, Y-tunnus)

### Step 2 — Client
- 10 diverse mock clients: mix of EU/non-EU, B2B/B2C, multiple countries (DE, FR, IT, FI, GB, US, NL, ES, BE, JP)
- Client list collapses to a selected-client card with a "Change" button once chosen
- "Add new client" button exists but is non-functional (intended for VIES enrichment flow)
- **Buyer tag** derived automatically: Domestic B2B, Domestic B2C, Intra-EU B2B, EU B2C, Export B2B, Export B2C

### Step 3 — Line Items
- **Catalogue + freeform** dual input:
  - When `items.length === 0`: catalogue is shown inline immediately (this is the primary path for users with a populated catalogue)
  - When `items.length > 0`: catalogue hides behind an "Add item" button; clicking opens a panel with catalogue search + a secondary "Custom item" toggle for freeform input
- **Catalogue items** carry pre-assigned `supplyType` (goods/services) and `cat` (category matching VAT data). Adding from catalogue does a **local rate lookup** — no API call, instant. Items get `conf: "high"` and a `CAT` badge.
- **Freeform items** are sent to the Claude API for classification. The classifier returns `rate`, `confidence` (high/medium/low), `category`, `supplyType` (goods/services), and `reasoning`.
- Each item has: qty, unit price (EUR), discount %, and a VAT rate selector (pills showing all rates for the seller's country)
- VAT rate can be manually overridden (shown with an "overridden" label)
- When buyer triggers zero-rating (intra-EU B2B or export), items show GOODS/SERVICES badges and the rate selector is locked to 0%

### Step 4 — Details & Payment
- Invoice date, due date, payment terms (dropdown auto-adjusts due date), payment method
- **Delivery / service period**: toggle between "Single date" and "Period" (start/end dates, defaults to current calendar month). Satisfies §14 Abs. 4 UStG and equivalents.
- **PDF language switcher**: EN, DE, FR, IT, ES, NL, FI. Affects **only** the A4 preview labels (INVOICE→RECHNUNG, table headers, section titles). The wizard form stays in English always.
- **Invoice currency switcher**: EUR, USD, GBP, CHF, SEK, DKK, NOK, PLN, CZK, JPY. Prices are entered in EUR in the wizard. Preview converts at approximate FX rates. When currency ≠ EUR, an "EUR equivalent" line appears below the total, and an FX disclaimer appears in the wizard.
- Bank details (IBAN/BIC shown when payment method is SEPA)
- PO/reference number, notes to client, footer/disclaimer fields

### Save & Send
- Two buttons: "Save draft" and "Send invoice". Both fire `alert()` — non-functional.

---

## VAT Logic

### Data Structure
The `VAT` object contains real rates as of 26 Feb 2026 for all 7 markets. Each country has:
- `std`: standard rate
- `rates`: array of `{r, l}` (rate number, label)
- `cats`: object keyed by rate, value is array of category strings
- `ex`: exemption scheme (name, short name, legal ref, threshold, legal mention text) — `null` for Spain
- `taxIdLabel`, `taxIdPlaceholder`, `vatPrefix`

### Classification
- `classify(desc, countryCode, buyerTag)` calls Claude Sonnet via the Anthropic API
- System prompt includes the country's rate table and buyer context
- Returns `{rate, confidence, category, supplyType, reasoning}`
- `lookupRate(category, countryCode)` does local lookup for catalogue items

### Zero-Rating Logic (the `resolvedItems` memo)
Each item gets an `effectiveRate` and `zeroReason` based on these rules in priority order:

1. **Exempt seller** → `effectiveRate: 0`, `zeroReason: "exempt"` (overrides everything)
2. **Intra-EU B2B + goods** → `effectiveRate: 0`, `zeroReason: "ics"` (Art. 138 intra-community supply)
3. **Intra-EU B2B + services** → `effectiveRate: 0`, `zeroReason: "rc"` (Art. 196 reverse charge)
4. **Export (any)** → `effectiveRate: 0`, `zeroReason: "export"`
5. **Otherwise** → `effectiveRate: item.rate`, `zeroReason: null`

This means a single invoice to an intra-EU B2B buyer can have **both** ICS and RC items with separate legal notices.

### Legal Mentions
Built dynamically from the actual items on the invoice (not from the buyer tag alone). If items span both goods and services for an intra-EU B2B buyer, two separate legal notices appear. Each notice lists the relevant item descriptions (up to 3).

### Re-Classification on Country Change
When the seller country changes:
- Catalogue items re-map locally via `lookupRate` (instant)
- Freeform items re-classify via the API (show spinner)
- Tracked via `useRef(prevCC)` and a `useEffect`

---

## A4 Preview

- Paginated: 18 items on page 1, 32 on continuation pages (conservative budgets)
- Page 1: full header (from/to blocks, invoice metadata, delivery info), line items table, and if single page: totals + payment + legal + notes
- Continuation pages: compact header (seller → client, invoice number), table continues
- Totals, payment details, legal mentions, notes always on last page
- Page X/Y indicator in bottom-right when multi-page
- All labels driven by the `LANG[pdfLang]` object — form-side labels are hardcoded English
- Amounts formatted in selected currency via `fmtAmt()`. EUR equivalent shown when currency ≠ EUR.
- Zero-rated items show colored badges: RC (blue), ICS (teal), EXP (green), EX (amber)
- Metadata tags below the preview show: seller country, buyer tag, currency, language, and any active zero-rating schemes

---

## Technical Architecture

### State
All state lives in `useState` hooks in the main `InvoiceBuilder` component. No external state management.

Key state: seller details (8 fields + country + exempt flag), client, items array, invoice metadata (dates, payment, notes, delivery type/dates), branding (color, display name), `pdfLang`, `curCode`, UI toggles (`showAddPanel`, `showFreeform`, `catSearch`, `clientListOpen`).

### Derived State (useMemo)
- `buyerTag`: Domestic/Intra-EU/Export × B2B/B2C
- `resolvedItems`: items with computed `effectiveRate` and `zeroReason`
- `legalMentions`: array of legal notice objects
- `vatGroups`: totals grouped by effective rate
- `pages`: items split across A4 pages
- `filteredCat`: catalogue filtered by search

### Components vs Render Functions
**Critical lesson from v6**: any function that returns JSX and is defined inside the main component body must be a **plain render function** (`const renderX = () => ...`), **not** a component (`const X = () => ...`). React treats inner components as new types on each render, causing unmount/remount thrashing and crashes.

Module-scope components (defined outside `InvoiceBuilder`): `Collapsible`, `Section`, `Field`, `ZeroBadge`, `A4Page`.

Inner render functions: `renderCatPanel`, `renderTH`, `renderItemRow`, `renderFooterBlock`.

### External Dependencies
- React (hooks: useState, useCallback, useRef, useMemo, useEffect)
- Anthropic API (`/v1/messages`, model `claude-sonnet-4-20250514`) — called directly from the browser, no API key needed in Claude.ai artifact context
- Google Fonts (Inter)
- No other dependencies. All styling is inline.

---

## Boss Feedback (27 Feb 2026) — Strategic Decisions

These decisions were made in a feedback session and should inform future development:

| Decision | Detail |
|---|---|
| **Web-first creation** | Justified by use patterns. Mobile-native editor not priority. |
| **AI classification** | Yes for assisted creation with guardrails. Not for autonomous filing. Requires tax advisor validation before shipping. |
| **Habit features** | High priority. Recency-sorted clients, line item memory per client, smart defaults. |
| **Auto-enrichment** | VIES/registry lookup for new client flow — high value, build it. |
| **Credit scoring in creation** | No. Payment behaviour analytics in receivables view — yes, but later. |

---

## Known Limitations & Gaps

### High Priority
- [ ] VIES enrichment for the "Add new client" flow (demonstrates differentiator)
- [ ] Validation on required fields (VAT ID format, mandatory fields per country)
- [ ] Unit of measure selector for manual items

### Medium Priority
- [ ] Re-classification `useEffect` has a fragile dependency array (includes `items` which changes on every classification result — potential infinite loop risk if not careful)
- [ ] EU B2C digital services (OSS/MOSS) completely unhandled
- [ ] France goods/services threshold fork shown in data but not interactive

### Low Priority / Acknowledged Prototype Limits
- [ ] Branding step changes don't affect preview
- [ ] Add client button non-functional
- [ ] Save/Send buttons non-functional
- [ ] No duplicate/previous invoice flow
- [ ] Classification prompt is minimal — no edge cases (mixed supplies within single item, digital services B2C thresholds, margin schemes)
- [ ] FX rates are hardcoded approximations, not live
- [ ] No persistence / local storage

---

## File Structure

Currently a single file:
```
invoice-builder.jsx   # ~660 lines, entire prototype
```

If breaking apart for real development, natural module boundaries would be:
- `vat-data.js` — VAT rates, categories, exemption schemes, legal texts
- `lang.js` — PDF label translations
- `currencies.js` — currency definitions and FX rates
- `clients.js` — mock client data (replace with API)
- `catalogue.js` — mock catalogue (replace with API)
- `classify.js` — Claude API classification + local lookup
- `components/` — Collapsible, Section, Field, ZeroBadge, A4Page
- `InvoiceBuilder.jsx` — main orchestrator
