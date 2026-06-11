-- Contact form submissions
-- Extends existing lead infrastructure with a general-purpose contact table

create type contact_subject as enum (
  'general',
  'partnership',
  'media',
  'distribution',
  'support',
  'feedback'
);

create type contact_status as enum (
  'new',
  'read',
  'replied',
  'archived'
);

create table contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject contact_subject not null default 'general',
  message text not null,
  status contact_status not null default 'new',
  admin_notes text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

-- Index for admin queries
create index idx_contact_submissions_status on contact_submissions(status, created_at desc);
create index idx_contact_submissions_email on contact_submissions(email);

-- RLS: only service_role can insert/read (API route uses admin client)
alter table contact_submissions enable row level security;
