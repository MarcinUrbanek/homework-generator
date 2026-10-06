alter table public.profiles
  add column display_name text,
  add constraint profiles_display_name_check check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 80
    )
  );

create table public.class_memberships (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

alter table public.class_memberships enable row level security;

create policy "Students can read their own class memberships"
  on public.class_memberships
  for select
  to authenticated
  using (student_id = (select auth.uid()));

revoke all on table public.class_memberships from anon, authenticated;
grant select on table public.class_memberships to authenticated;
grant select, insert, update, delete on table public.class_memberships to service_role;

create index class_memberships_student_joined_at_index
  on public.class_memberships (student_id, joined_at desc);

drop index public.class_invitations_token_digest_index;
create unique index class_invitations_token_digest_unique_index
  on public.class_invitations (token_digest);

create function public.preview_class_by_code(p_class_code text)
returns table (
  class_id uuid,
  class_name text,
  teacher_display_name text,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_class_code text := upper(btrim(p_class_code));
begin
  if authenticated_user_id is null or normalized_class_code !~ '^[A-Z0-9]{8}$' then
    return;
  end if;

  return query
  select
    class_record.id,
    class_record.name,
    teacher_profile.display_name,
    exists (
      select 1
      from public.class_memberships as membership
      where membership.class_id = class_record.id
        and membership.student_id = authenticated_user_id
    )
  from public.classes as class_record
  join public.profiles as teacher_profile
    on teacher_profile.id = class_record.teacher_id
  where class_record.class_code = normalized_class_code;
end;
$$;

revoke all on function public.preview_class_by_code(text) from public, anon;
grant execute on function public.preview_class_by_code(text) to authenticated;

create function public.accept_class_by_code(p_class_code text)
returns table (class_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_class_code text := upper(btrim(p_class_code));
  accepted_class_id uuid;
  membership_already_existed boolean;
begin
  if authenticated_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  if normalized_class_code !~ '^[A-Z0-9]{8}$' then
    raise exception using
      errcode = 'P0002',
      message = 'Class code is unavailable';
  end if;

  select class_record.id
  into accepted_class_id
  from public.classes as class_record
  where class_record.class_code = normalized_class_code
  for key share;

  if accepted_class_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Class code is unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(accepted_class_id::text || ':' || authenticated_user_id::text, 0)
  );

  select exists (
    select 1
    from public.class_memberships as membership
    where membership.class_id = accepted_class_id
      and membership.student_id = authenticated_user_id
  )
  into membership_already_existed;

  insert into public.profile_roles (user_id, role)
  values (authenticated_user_id, 'student')
  on conflict (user_id, role) do nothing;

  insert into public.class_memberships (class_id, student_id)
  values (accepted_class_id, authenticated_user_id)
  on conflict on constraint class_memberships_pkey do nothing;

  class_id := accepted_class_id;
  already_member := membership_already_existed;
  return next;
end;
$$;

revoke all on function public.accept_class_by_code(text) from public, anon;
grant execute on function public.accept_class_by_code(text) to authenticated;

create function public.list_my_class_memberships()
returns table (
  class_id uuid,
  class_name text,
  teacher_display_name text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
begin
  if authenticated_user_id is null then
    return;
  end if;

  return query
  select
    membership.class_id,
    class_record.name,
    teacher_profile.display_name,
    membership.joined_at
  from public.class_memberships as membership
  join public.classes as class_record
    on class_record.id = membership.class_id
  join public.profiles as teacher_profile
    on teacher_profile.id = class_record.teacher_id
  where membership.student_id = authenticated_user_id
  order by membership.joined_at desc, membership.class_id;
end;
$$;

revoke all on function public.list_my_class_memberships() from public, anon;
grant execute on function public.list_my_class_memberships() to authenticated;

create function public.set_teacher_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  normalized_display_name text := btrim(p_display_name);
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  if normalized_display_name is null
    or normalized_display_name = ''
    or char_length(normalized_display_name) > 80 then
    raise exception using
      errcode = '22023',
      message = 'Display name must contain between 1 and 80 characters';
  end if;

  update public.profiles
  set display_name = normalized_display_name
  where id = authenticated_teacher_id;

  return normalized_display_name;
end;
$$;

revoke all on function public.set_teacher_display_name(text) from public, anon;
grant execute on function public.set_teacher_display_name(text) to authenticated;

create function public.accept_class_invitation(p_token_digest text)
returns table (class_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  authenticated_email text;
  invitation_record public.class_invitations%rowtype;
  membership_already_existed boolean;
begin
  if authenticated_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  if p_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = 'P0002',
      message = 'Invitation is unavailable';
  end if;

  select lower(btrim(auth_user.email))
  into authenticated_email
  from auth.users as auth_user
  where auth_user.id = authenticated_user_id;

  select invitation.*
  into invitation_record
  from public.class_invitations as invitation
  where invitation.token_digest = p_token_digest
  for update;

  if not found
    or invitation_record.delivery_state <> 'sent'
    or invitation_record.expires_at <= statement_timestamp()
    or authenticated_email is null
    or invitation_record.normalized_email is distinct from authenticated_email then
    raise exception using
      errcode = 'P0002',
      message = 'Invitation is unavailable';
  end if;

  if invitation_record.redeemed_at is not null then
    if invitation_record.redeemed_by <> authenticated_user_id or not exists (
      select 1
      from public.class_memberships as membership
      where membership.class_id = invitation_record.class_id
        and membership.student_id = authenticated_user_id
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Invitation is unavailable';
    end if;

    class_id := invitation_record.class_id;
    already_member := true;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      invitation_record.class_id::text || ':' || authenticated_user_id::text,
      0
    )
  );

  select exists (
    select 1
    from public.class_memberships as membership
    where membership.class_id = invitation_record.class_id
      and membership.student_id = authenticated_user_id
  )
  into membership_already_existed;

  insert into public.profile_roles (user_id, role)
  values (authenticated_user_id, 'student')
  on conflict (user_id, role) do nothing;

  insert into public.class_memberships (class_id, student_id)
  values (invitation_record.class_id, authenticated_user_id)
  on conflict on constraint class_memberships_pkey do nothing;

  update public.class_invitations
  set
    redeemed_at = statement_timestamp(),
    redeemed_by = authenticated_user_id,
    updated_at = statement_timestamp()
  where id = invitation_record.id;

  class_id := invitation_record.class_id;
  already_member := membership_already_existed;
  return next;
end;
$$;

revoke all on function public.accept_class_invitation(text) from public, anon;
grant execute on function public.accept_class_invitation(text) to authenticated;