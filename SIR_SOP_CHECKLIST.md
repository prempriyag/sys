# SIR Impact Analysis – SOP Compliance Checklist

**Document ID:** TN-VOTER-ANALYTICS-01  
**SOP Version:** 1.0 | **Date:** October 26, 2025  
**Confidentiality:** Internal Use Only

This checklist is derived from the Standard Operating Procedure (SOP) for Special Intensive Revision (SIR) Impact Analysis. Each item is mapped to implementation status and priority.

---

## 1. OBJECTIVE & SCOPE

| Item | Status | Priority | Notes |
|------|--------|----------|--------|
| Objective defined | ✅ Completed | P1 | Identify, quantify, interpret electoral roll changes (SIR) |
| Scope In-Scope documented | ✅ Completed | P1 | Pre/Post-SIR comparison, booth-level metrics, GIS, field validation sampling |
| Scope Out-of-Scope documented | ✅ Completed | P2 | Legal filing (data support only); manual door-to-door (sampling only) |

---

## 2. ROLES & RESPONSIBILITIES

| Role | Assigned | Priority | Responsibility |
|------|----------|----------|-----------------|
| SIR Project Lead | ⏳ Pending | P2 | Overall ownership, strategy alignment, final reporting |
| Roll Data Engineer | ⏳ Pending | P2 | Data ingestion, cleaning, database management |
| Matching Analyst | ⏳ Pending | P2 | Fuzzy matching algorithms, record classification |
| GIS Analyst | ⏳ Pending | P2 | Spatial mapping, heatmap generation, boundary validation |
| Political Analyst | ⏳ Pending | P2 | Interpretation into political insights (caste/community) |
| Field Validation Lead | ⏳ Pending | P2 | Ground teams for physical verification of anomalies |

---

## 3. DATA ACQUISITION & STANDARDIZATION

| Item | Status | Priority | Notes |
|------|--------|----------|--------|
| Pre-SIR Electoral Roll source | ✅ Completed | P1 | PDF/Text – upload & parse implemented |
| Post-SIR Electoral Roll source | ✅ Completed | P1 | PDF/Text – upload & parse implemented |
| ECI Booth List & Constituency Maps source | ⏳ Pending | **P1** | Required for booth validation and GIS boundary validation |
| Historical Turnout Data (Last 2 Elections) source | ⏳ Pending | **P1** | Required for risk model (High Risk: deletions >5% AND turnout >70%) |
| Text Normalization | ✅ Completed | P1 | Uppercase; remove non-alphanumeric from address – NormalizationService |
| Language Handling (Tamil–English transliteration) | ✅ Completed | P1 | NormalizationService |
| Booth count validation vs ECI lists | ✅ Completed | P1 | Booth creation/validation logic |

---

## 4. ANALYTICAL LOGIC

| Item | Status | Priority | Notes |
|------|--------|----------|--------|
| Exact Match (EPIC Primary Key) | ✅ Completed | P1 | MatchingEngine |
| Fuzzy Match (Name + Relative + Door No >90%) | ✅ Completed | P1 | rapidfuzz in MatchingEngine |
| Family Clustering (House Number) | ✅ Completed | P1 | analyze_families – household shifts & anomaly (>15) |
| Classification: UNCHANGED / ADDED / DELETED / MODIFIED / MIGRATED | ✅ Completed | P1 | MatchResult model and MatchingEngine |

---

## 5. KEY PERFORMANCE INDICATORS & RISK MODEL

| Item | Status | Priority | Notes |
|------|--------|----------|--------|
| Net Roll Change % | ✅ Completed | P1 | KPIEngine |
| Deletion Velocity | ✅ Completed | P1 | KPIEngine |
| Youth Intake (18–19 and 20–25 age bands) | ✅ Completed | P1 | KPIEngine |
| Gender Balance Shift | ✅ Completed | P1 | KPIEngine |
| High Risk Deletion (>5% deletions AND turnout >70%) | ✅ Completed | P1 | KPIEngine risk_category HIGH_RISK |
| High Opportunity Addition (>10% new voters) | ✅ Completed | P1 | KPIEngine HIGH_OPPORTUNITY |
| Anomaly Flag (>15 voters per household) | ✅ Completed | P1 | KPIEngine ANOMALY from analyze_families |

---

## 6. FIELD VALIDATION & REPORTING

| Item | Status | Priority | Notes |
|------|--------|----------|--------|
| Top 10 High Risk booths per constituency | ✅ Completed | P1 | GET `/api/sir/analytics/high-risk/{id}?limit=10` |
| 5% random sample of Deleted voters | ✅ Completed | P1 | GET `/api/sir/analytics/validation-sample/{id}?sample_percent=5` |
| New Additions in non-residential zones (industrial/warehouse) | ⏳ Pending | **P2** | Requires zone/land-use data or tagging |
| Executive Summary (Win/Loss estimation) | ✅ Completed | P1 | Dashboard aggregates |
| Booth Action Plan | ✅ Completed | P1 | High-risk booth list and analytics |
| Spatial Heatmaps (deletion/addition clusters) | ✅ Completed | P1 | Risk Heatmap page and dashboard |

---

## PENDING TASKS – PRIORITY ORDER

Tasks below are **pending** and ordered by **priority (P1 → P2)** for execution.

### P1 – Critical (Data & model integrity)

These unblock full SOP compliance and accurate risk scoring.

| # | Task | SOP Ref | Action |
|---|------|---------|--------|
| 1 | **ECI Booth List & Constituency Maps source** | §3.1 | Identify and integrate official ECI booth list and constituency boundary data; validate booth counts before processing; support GIS boundary validation. |
| 2 | **Historical Turnout Data (Last 2 Elections) source** | §3.1, §5.2 | Source and load historical turnout at booth/constituency level for last 2 elections; wire into Booth model (e.g. `turnout_percentage`) so High Risk rule (>5% deletions AND turnout >70%) uses real data. |

### P2 – High (Operations & targeting)

Required for operational rollout and complete field validation.

| # | Task | SOP Ref | Action |
|---|------|---------|--------|
| 3 | **Role assignments (all six roles)** | §2 | Assign and document SIR Project Lead, Roll Data Engineer, Matching Analyst, GIS Analyst, Political Analyst, Field Validation Lead. |
| 4 | **New Additions in non-residential zones** | §6.1 | Define “non-residential” (e.g. industrial, warehouse); add zone/land-use data or tags; implement API or report listing new additions in these zones for field targeting. |

---

## Summary

- **Checklist source:** SOP TN-VOTER-ANALYTICS-01 v1.0 (Oct 26, 2025).  
- **Structured checklist (CSV):** `SIR_SOP_CHECKLIST.csv` (columns: Document ID, SOP Section, Item, Status, Priority, Notes).  
- **Pending:** 2 P1 tasks (data sources), 2 P2 task groups (roles + non-residential targeting).  
- **Completed:** Objective & scope, Pre/Post roll ingestion & standardization, matching & classification, booth KPIs, risk model, high-risk booths, 5% deleted sample, executive summary, booth action plan, spatial heatmaps.
