# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/260ab8d9-fa87-4fb0-91da-fd42a1fa7e6a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/260ab8d9-fa87-4fb0-91da-fd42a1fa7e6a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/260ab8d9-fa87-4fb0-91da-fd42a1fa7e6a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## CI / GitHub Actions secrets

The workflows in `.github/workflows/` (`edge-function-tests.yml` and
`security-regression.yml`) need the two secrets below. Add them under
**Repository Settings → Secrets and variables → Actions → New repository secret**:

| Secret name                     | Value                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The `VITE_SUPABASE_URL` from your local `.env` — the public backend URL used by the Deno test suite.     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `VITE_SUPABASE_PUBLISHABLE_KEY` from your local `.env` — the publishable/anon key, safe to expose.   |

Both are publishable client-side values (never the service-role key or DB
password). The workflows write them into a temporary `.env` before running
`deno test` and never echo them to logs.

## Audit log access control (`public.audit_logs`)

The `admin-notifications` edge function writes `admin_notifications_rejected`
rows (and every other admin audit event) into `public.audit_logs`. Access to
that table is deliberately narrow — do **not** weaken it in future migrations.

**Grants** (see `supabase/migrations/*audit_logs*.sql`):

| Role            | Privileges   | Rationale                                                |
| --------------- | ------------ | -------------------------------------------------------- |
| `service_role`  | `ALL`        | Edge functions insert audit rows with the service key.   |
| `authenticated` | `SELECT`     | Required so RLS can even evaluate for signed-in admins.  |
| `anon`          | *(no grant)* | Anonymous callers must never reach this table, period.   |

**Row-Level Security policies** (all `FOR SELECT`, gated by
`has_role(auth.uid(), …)` — a `SECURITY DEFINER` helper that reads
`public.user_roles`):

1. **`Super admins can view all audit logs`** —
   `USING (has_role(auth.uid(), 'super_admin'))`. Super admins see every row,
   including `admin_notifications_rejected` (which uses
   `target_type = 'edge_function'`).
2. **`Admins can view relevant audit logs`** —
   `USING (has_role(auth.uid(), 'admin') AND (user_id = auth.uid() OR target_type IN ('user','role','plan')))`.
   Regular admins see only their own actions plus user/role/plan events.

There are intentionally no `INSERT`, `UPDATE`, or `DELETE` policies: writes
go through the service role from edge functions, and client-side mutation is
impossible.

Regression coverage lives in
`supabase/functions/_tests/audit_logs_rls_test.ts` and asserts that (a) the
anon key cannot read `admin_notifications_rejected` rows and (b) the required
grants exist in the migration history with no anon grant.


