👨‍👩‍👧‍👦 Family Tree – ft_transcendence
📍 Summary

We are building a family tree & collaboration platform using Next.js (frontend), NestJS (backend), Prisma (ORM), Supabase (auth), PostgreSQL, and Tailwind CSS.

The current codebase have:

    User authentication with Supabase (email/password + Google/GitHub OAuth)

    JWT token handling

    Basic tree and profile (person) management

    Role‑based permissions within trees (ADMIN, MODERATOR, MEMBER, VIEWER)

    A custom design system with a colour palette, typography, and reusable components (10+ components)

    Containerised deployment with Docker / docker‑compose

All services run with a single make up command.
🧩 Modules – Progress & To‑Do

We have chosen the following modules.
Completed ✅ are already functional; In‑progress 🔄 need finishing; Not started ❌ need implementation.
Module	Type	Points	Status	Notes
Use a frontend framework (React/Next.js)	Minor	1	✅ Done	Next.js 14
Use a backend framework (NestJS)	Minor	1	✅ Done	NestJS 10
Use an ORM (Prisma)	Minor	1	✅ Done	Prisma with Supabase Postgres
Custom design system with ≥10 reusable components	Minor	1	✅ Done	Components: Button, Navbar, Footer, Banner, FeatureCard, FeaturesGrid, SectionHeader, Typography, Icon, SkipLink
Remote authentication with OAuth 2.0 (Google, GitHub)	Minor	1	✅ Done	Supabase OAuth integrated
Standard user management and authentication	Major	2	🔄 Partial	Login/signup working, but still need: avatar upload, friends system, online status, profile page
Advanced permissions system (global roles)	Major	2	🔄 Partial	Tree‑specific roles exist, but global user roles (admin, moderator) are missing; need CRUD for users
Organization system (trees as orgs)	Major	2	🔄 Partial	Trees exist with members and roles; need to implement: edit/delete tree, add/remove members via UI, invitation system
Real‑time features (WebSockets)	Major	2	❌ Not started	Chat, real‑time updates, notifications
Public API with secured API key, rate limiting, docs, ≥5 endpoints	Major	2	❌ Not started	Need to expose a public API for e.g. public trees or profiles
Complete notification system for CRUD actions	Minor	1	❌ Not started	Should be integrated with WebSockets
Real‑time collaborative features (shared workspaces, live editing)	Minor	1	❌ Not started	Could be part of WebSocket real‑time features
Advanced search with filters, sorting, pagination	Minor	1	❌ Not started	For trees and profiles
Complete accessibility compliance (WCAG 2.1 AA)	Major	2	❌ Not started	Need audit and fixes (keyboard nav, screen reader, ARIA)
Support for additional browsers (Firefox, Safari, Edge)	Minor	1	❌ Not started	Test and document cross‑browser compatibility
2FA (Two‑Factor Authentication)	Minor	1	❌ Not started	TOTP or SMS
User activity analytics dashboard	Minor	1	❌ Not started	Show user actions, logs, insights
Total possible points

Completed so far: 1+1+1+1+1 = 5 points
Remaining (if we implement everything) = 2+2+2+2+2+1+1+1+1+2+1+1+1+1 = 18 points
Minimum required: 14 points – we have more than enough, so we can choose which to prioritise.
📋 1‑Week Plan (4 People)

We have one week left. Below is a task breakdown by person. Each task includes a rough effort estimate.
👤 Person A – Real‑time & Notifications

    Real‑time features (WebSockets) – 2 pts

        Set up WebSocket gateway in NestJS

        Implement chat between users (direct and tree‑based)

        Handle connection/disconnection, broadcast events

    Notification system – 1 pt

        Create notification model (Prisma)

        Push notifications on create/update/delete actions

        Display notifications in frontend (with real‑time updates)

👤 Person B – Public API & Search

    Public API – 2 pts

        Design public endpoints (e.g., /api/public/trees, /api/public/profiles)

        Secure with API key (header)

        Add rate limiting (e.g., using @nestjs/throttler)

        Document using OpenAPI/Swagger

    Advanced search – 1 pt

        Implement search endpoint with filters (name, date, tree)

        Add sorting and pagination (Prisma skip/take)

        Frontend search UI

👤 Person C – User Management

    Complete user management – 2 pts

        Profile page (view/edit)

        Avatar upload (file upload)

        Friends system (add/remove, list)

        Online status (using WebSocket presence)

	Advanced permissions (global roles) – 2 pts

        Add role field to User (admin, user, moderator)

        Implement user management UI (list, edit, delete, change roles)

        Restrict admin panel to admins

👤 Person D – Accessibility, Permissions & Browsers

    Accessibility (WCAG 2.1 AA) – 2 pts

        Audit with Lighthouse/axe

        Fix keyboard navigation, ARIA labels, semantic HTML

        Ensure screen reader compatibility

    Additional browsers – 1 pt

        Test on Firefox, Safari (macOS), Edge

        Fix layout/CSS issues

        Document differences

	2FA – 1 pt

        TOTP setup, verification, recovery codes

Shared / Overflow Tasks

    Organization system (trees as orgs) – 2 pts (can be split among A, C, D)

        Edit/delete tree (admin only)

        Add/remove members via UI (admin only)

        Invitation system (already has model, need frontend)

    Real‑time collaborative features – 1 pt (can be included in Person A’s WebSocket work)

🗃️ Codebase Overview (What’s Already Done)
Frontend (Next.js)

    /app/page.tsx – landing page with design system components

    /app/login – login with email/password and OAuth buttons

    /app/signup – signup with validation

    /app/tree – list of user’s trees, create/join/search modals

    /app/dashboard – tree view with members, profiles, role management

    /app/consent – OAuth callback handler

    Design system: components (Button, Navbar, Footer, Banner, FeatureCard, FeaturesGrid, SectionHeader, Typography, Icon, SkipLink)

Backend (NestJS)

    src/api/auth – Supabase OAuth + JWT

    src/api/profile – CRUD for persons (renamed Profile)

    src/api/tree – tree creation, joining, search, members, roles

    src/prisma – Prisma client with PrismaPg driver adapter

    src/supabase – Supabase client module

    Database schema (Prisma) with User, Tree, TreeMember, Invitation, Profile, ProfileSpouse, Event, AuditLog

    Global prefix /api – routes are /api/auth/login, /api/trees/..., etc.

Deployment

    Docker & docker‑compose with development volumes

    make up starts all services

    Backend uses HTTPS with self‑signed certificate (mounted from ./certs)

    Frontend uses next dev --experimental-https
