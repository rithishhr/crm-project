Deployment and Git push instructions
==================================

1) What I did:
 - Removed large build and model files from the repo so it can be pushed to GitHub safely.
 - Added `.env.example` and a repo scan tool at `tools/scan-large-files.js`.
 - Added a root `.gitignore` that excludes `dist`, `public/models`, env files, and caches.

2) How to push to GitHub (you can run these locally or provide a GitHub token and I will push for you):

  # Create repo on GitHub (or create via GitHub UI)
  git remote add origin https://github.com/<your-username>/<repo-name>.git
  git push -u origin main

  If you prefer I push it for you, provide one of:
   - the GitHub repo URL and a Personal Access Token (PAT) with `repo` scope (I will use it to set remote and push), OR
   - create the empty repo and give me the URL and I will push.

3) Deploy backend (recommended: Render or Railway)
 - Build: `cd gcc360-api && npm install && npm run build`
 - Start command for service: `npm run start` (make sure `DATABASE_URL`, `SESSION_SECRET` and optionally `GROQ_API_KEY` are set)
 - Set environment variables in the host dashboard using the values from `.env.example`.

4) Deploy frontend (recommended: Vercel or Netlify)
 - Build: `cd gcc360-crm && npm install && npm run build`
 - Set `VITE_API_URL` to your backend URL in project settings.

5) Database (free tier option)
 - Use Supabase: create project, get Postgres `DATABASE_URL`, then run:
   cd gcc360-api
   npm install
   npx prisma db push --accept-data-loss
   npm run db:seed

6) After push: I can help connect GitHub to the deployments and configure environment variables.
