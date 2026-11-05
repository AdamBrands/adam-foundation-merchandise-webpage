-- Adam Foundation connect page: QR scans and Adhkar book requests.
-- Supabase project: adam-foundation-connect (xomihzevrziigvjxqmjk), region eu-west-2.
--
-- Both tables have RLS on. anon/authenticated have no grants and no policies,
-- so Supabase's public Data API cannot read or write them. The site's server
-- functions connect as connect_writer, which has policies for its own access.

create table public.scans (
  id          bigint generated always as identity primary key,
  code        text        not null check (code ~ '^[a-z0-9-]{1,40}$'),
  device      text        not null check (device in ('ios', 'android', 'other')),
  created_at  timestamptz not null default now()
);
create index scans_code_created_at_idx on public.scans (code, created_at);
create index scans_created_at_idx on public.scans (created_at);

create table public.book_requests (
  id                bigint generated always as identity primary key,
  email             text        not null check (char_length(email) between 3 and 254),
  marketing_opt_in  boolean     not null default false,
  consent_text      text        not null, -- exact checkbox wording shown
  consent_version   text        not null,
  source            text        not null default 'direct' check (source ~ '^[a-z0-9-]{1,40}$'),
  device            text        not null check (device in ('ios', 'android', 'other')),
  is_test           boolean     not null default false,
  email_status      text        not null default 'pending'
                    check (email_status in ('pending', 'sent', 'failed', 'duplicate')),
  email_id          text,
  email_error       text,
  created_at        timestamptz not null default now()
);
create index book_requests_email_created_at_idx on public.book_requests (lower(email), created_at);
create index book_requests_source_created_at_idx on public.book_requests (source, created_at);

alter table public.scans enable row level security;
alter table public.book_requests enable row level security;

revoke all on public.scans, public.book_requests from anon, authenticated;

-- Server role. Created without login; set its password once in the SQL editor:
--   alter role connect_writer with login password '<generated password>';
create role connect_writer nologin;
grant usage on schema public to connect_writer;
grant select, insert on public.scans to connect_writer;
grant select, insert, update on public.book_requests to connect_writer;

create policy connect_writer_scans on public.scans
  for all to connect_writer using (true) with check (true);
create policy connect_writer_book_requests on public.book_requests
  for all to connect_writer using (true) with check (true);

-- Kawthar page (/kawthar): mosque bottle applications, support offers and
-- adhkar book requests. Added November 2026. Same access pattern as above.
create table public.kawthar_submissions (
  id                bigint generated always as identity primary key,
  form              text        not null check (form in ('mosque', 'support', 'book')),
  name              text        not null check (char_length(name) between 1 and 100),
  email             text        not null check (char_length(email) between 3 and 254),
  data              jsonb       not null, -- every validated answer, as submitted
  marketing_opt_in  boolean     not null default false,
  consent_text      text        not null, -- exact checkbox wording shown
  consent_version   text        not null,
  source            text        not null default 'kawthar' check (source ~ '^[a-z0-9-]{1,40}$'),
  device            text        not null check (device in ('ios', 'android', 'other')),
  is_test           boolean     not null default false,
  email_status      text        not null default 'pending'
                    check (email_status in ('pending', 'sent', 'partial', 'failed', 'duplicate')),
  email_id          text,
  email_error       text,
  created_at        timestamptz not null default now()
);
create index kawthar_submissions_form_email_created_at_idx on public.kawthar_submissions (form, lower(email), created_at);
create index kawthar_submissions_created_at_idx on public.kawthar_submissions (created_at);

alter table public.kawthar_submissions enable row level security;
revoke all on public.kawthar_submissions from anon, authenticated;
grant select, insert, update on public.kawthar_submissions to connect_writer;
create policy connect_writer_kawthar_submissions on public.kawthar_submissions
  for all to connect_writer using (true) with check (true);
