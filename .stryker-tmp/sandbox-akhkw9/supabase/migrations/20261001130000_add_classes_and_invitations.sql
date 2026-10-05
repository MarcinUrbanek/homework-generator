create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and name <> ''),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes enable row level security;

create policy "Teachers can read their own classes"
  on public.classes
  for select
  to authenticated
  using (
    (select public.is_teacher())
    and teacher_id = (select auth.uid())
  );

revoke all on table public.classes from anon, authenticated;
grant select on table public.classes to authenticated;
grant select, insert, update, delete on table public.classes to service_role;

create index classes_teacher_id_index on public.classes (teacher_id);

create table public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  normalized_email text not null check (normalized_email = lower(btrim(normalized_email)) and normalized_email <> ''),
  token_digest text not null check (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  delivery_state text not null default 'pending' check (delivery_state in ('pending', 'sent', 'failed')),
  provider_message_id text,
  sent_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_invitations_class_email_unique unique (class_id, normalized_email),
  constraint class_invitations_delivery_fields_check check (
    (delivery_state = 'sent' and provider_message_id is not null and sent_at is not null)
    or (delivery_state in ('pending', 'failed') and provider_message_id is null and sent_at is null)
  ),
  constraint class_invitations_redemption_fields_check check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

alter table public.class_invitations enable row level security;

revoke all on table public.class_invitations from anon, authenticated;
grant select, insert, update, delete on table public.class_invitations to service_role;

create index class_invitations_token_digest_index on public.class_invitations (token_digest);

create function public.create_class(p_name text)
returns table (class_id uuid, class_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  trimmed_name text := btrim(p_name);
  generated_class_code text;
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  if trimmed_name = '' then
    raise exception using
      errcode = '22023',
      message = 'Class name is required';
  end if;

  loop
    generated_class_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.classes (teacher_id, name, class_code)
      values (authenticated_teacher_id, trimmed_name, generated_class_code)
      returning id, public.classes.class_code into class_id, class_code;

      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create function public.prepare_class_invitations(
  p_class_id uuid,
  p_emails text[],
  p_token_digests text[]
)
returns table (
  recipient_email text,
  invitation_id uuid,
  preparation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  invitation record;
  existing_invitation_id uuid;
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  if cardinality(p_emails) is distinct from cardinality(p_token_digests) then
    raise exception using
      errcode = '22023',
      message = 'Each invitation email requires one token digest';
  end if;

  if cardinality(p_emails) < 1 or cardinality(p_emails) > 50 then
    raise exception using
      errcode = '22023',
      message = 'One to 50 invitations are required';
  end if;

  if not exists (
    select 1
    from public.classes
    where id = p_class_id
      and teacher_id = authenticated_teacher_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Class ownership is required';
  end if;

  for invitation in
    select distinct on (lower(btrim(email)))
      lower(btrim(email)) as normalized_email,
      token_digest,
      position
    from unnest(p_emails, p_token_digests) with ordinality as input(email, token_digest, position)
    where btrim(email) <> ''
      and token_digest ~ '^[a-f0-9]{64}$'
    order by lower(btrim(email)), position
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_class_id::text || ':' || invitation.normalized_email, 0)
    );
  end loop;

  if (
    select count(*)
    from unnest(p_emails, p_token_digests) as input(email, token_digest)
    where btrim(email) = '' or token_digest !~ '^[a-f0-9]{64}$'
  ) > 0 then
    raise exception using
      errcode = '22023',
      message = 'Invitation emails and token digests must be valid';
  end if;

  for invitation in
    select distinct on (lower(btrim(email)))
      lower(btrim(email)) as normalized_email,
      token_digest,
      position
    from unnest(p_emails, p_token_digests) with ordinality as input(email, token_digest, position)
    order by lower(btrim(email)), position
  loop
    select id
    into existing_invitation_id
    from public.class_invitations
    where class_id = p_class_id
      and normalized_email = invitation.normalized_email;

    if existing_invitation_id is null then
      insert into public.class_invitations (
        class_id,
        normalized_email,
        token_digest,
        expires_at
      )
      values (
        p_class_id,
        invitation.normalized_email,
        invitation.token_digest,
        now() + interval '7 days'
      )
      returning id into invitation_id;

      recipient_email := invitation.normalized_email;
      preparation := 'created';
    else
      update public.class_invitations
      set
        token_digest = invitation.token_digest,
        expires_at = now() + interval '7 days',
        delivery_state = 'pending',
        provider_message_id = null,
        sent_at = null,
        updated_at = now()
      where id = existing_invitation_id;

      invitation_id := existing_invitation_id;
      recipient_email := invitation.normalized_email;
      preparation := 'refreshed';
    end if;

    return next;
  end loop;
end;
$$;

create function public.record_class_invitation_delivery(
  p_invitation_id uuid,
  p_token_digest text,
  p_delivery_state text,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'A valid token digest is required';
  end if;

  if p_delivery_state = 'sent' and (p_provider_message_id is null or btrim(p_provider_message_id) = '') then
    raise exception using
      errcode = '22023',
      message = 'A provider message ID is required for sent invitations';
  end if;

  if p_delivery_state not in ('sent', 'failed') then
    raise exception using
      errcode = '22023',
      message = 'Delivery state must be sent or failed';
  end if;

  update public.class_invitations
  set
    delivery_state = p_delivery_state,
    provider_message_id = case when p_delivery_state = 'sent' then btrim(p_provider_message_id) else null end,
    sent_at = case when p_delivery_state = 'sent' then now() else null end,
    updated_at = now()
  where id = p_invitation_id
    and token_digest = p_token_digest;

  return found;
end;
$$;

revoke all on function public.create_class(text) from public;
revoke all on function public.prepare_class_invitations(uuid, text[], text[]) from public;
revoke all on function public.record_class_invitation_delivery(uuid, text, text, text) from public;
revoke execute on function public.record_class_invitation_delivery(uuid, text, text, text) from anon, authenticated;

grant execute on function public.create_class(text) to authenticated;
grant execute on function public.prepare_class_invitations(uuid, text[], text[]) to authenticated;
grant execute on function public.record_class_invitation_delivery(uuid, text, text, text) to service_role;