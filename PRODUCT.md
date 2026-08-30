# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Recruiters and hiring teams evaluating Full-Stack Software Engineer candidates. Candidates use the interview surface to answer evidence-grounded technical questions.

## Product Purpose

Foxy verifies software-engineer claims using CV and public GitHub evidence, conducts an adaptive technical interview, and produces a transparent vetting report. Success means a recruiter can understand what was claimed, what public evidence supports it, how it was challenged, and what the candidate demonstrated.

## Positioning

Foxy follows a traceable Claim → Evidence → Challenge → Verification chain instead of conducting a generic AI interview.

## Operating Context

A recruiter creates or selects a Full-Stack Software Engineer role, submits candidate CV text and a public GitHub URL, reviews extracted evidence, runs a voice or text interview, and receives a final assessment. Convex stores and streams workflow state. Context.dev analyzes public web evidence. OpenRouter generates and evaluates technical interview content. ElevenLabs supplies interview voice.

## Capabilities and Constraints

The hackathon MVP supports one role: Full-Stack Software Engineer. It assesses React, TypeScript, APIs and backend, databases, testing, Docker, and AWS. It does not include coding challenges, anti-cheating, LinkedIn scraping, ATS integration, scheduling, payments, company accounts, or multi-role support. Public evidence absence is treated as uncertainty rather than dishonesty. Every judgment must retain evidence references.

## Evidence on Hand

The repository includes working Context.dev extraction, evidence mapping, adaptive questions, answer evaluation, final reporting, ElevenLabs speech, browser speech recognition, deterministic fallback behavior, and Convex-ready event payloads. Test data is synthetic.

## Product Principles

- Preserve the Claim → Evidence → Challenge → Verification chain.
- Show the evidence behind every technical judgment.
- Treat missing public evidence as a reason to probe, not proof of deception.
- Prefer one stable end-to-end journey over additional features.
- Keep voice optional and retain a reliable text fallback.
