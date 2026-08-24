# ft_transcendence

Script to copy all file with path to feed to AI
run at wsl terminal

find /home/huidris/Desktop/ft_transcendence/ -type f -not -path '*/.git/*' -not -path '*/.agents/*' -not -path '*/.claude/*' -not -path '*/.windsurf/*' -not -path '*/.next/*' -not -path '*/dist/*' -not -path '*/node_modules/*' -not -name '*.gz' -not -name 'package-lock.json' | while read -r file; do echo -e "\n=== FILENAME: ${file#/home/huidris/Desktop/ft_transcendence/} ===\n" >> /home/huidris/Desktop/ft_transcendence/code.txt; cat "$file" >> /home/huidris/Desktop/ft_transcendence/code.txt; done


Creating a family tree platform

How to run

make up
make logs

Open on browser http://localhost:3000/login

Sign in with
Email: admin@family.test
Password: password

PROJECT FLOW
Database – PostgreSQL 16 (containerised), storing users and persons tables.

Backend – NestJS (Node.js framework) with:

pg for raw SQL queries (no ORM, though you have class-validator and class-transformer installed).

@nestjs/jwt + passport-jwt for JWT‑based authentication.

@nestjs/config for environment variables.

bcryptjs for password hashing.

Frontend – Next.js 14 (React framework) with client‑side authentication and a simple dashboard.

Docker orchestrates three services:

db – PostgreSQL container with initialisation script (init.sql).

backend – NestJS API, depends on a healthy db.

frontend – Next.js app, depends on backend.

AUTHENTICATION FLOW
User visits http://localhost:3000/login, enters admin@family.test / password.

Frontend sends a POST /auth/login request to the backend API (http://backend:4000 via container networking, or http://localhost:4000 if running natively).

Backend (in AuthService.login) queries the users table for the given email, compares the provided password with the stored hash using bcrypt.compare, and if valid, generates a JWT token using @nestjs/jwt.

The backend responds with { accessToken: "...", user: {...} }.

Frontend stores the token in localStorage (key 'ft_token') and redirects to /dashboard.

The dashboard fetches /persons by including the token in the Authorization: Bearer <token> header.

The backend validates the JWT via JwtStrategy and returns the list of persons.
