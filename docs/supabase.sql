-- Posyandu Bangau: skema Supabase.
-- Jalankan sekali di Supabase > SQL Editor > New query > Run.
-- Belum diuji pada proyek Supabase sungguhan. Jalankan di proyek baru dan baca pesan galatnya.

-- ============ Profil akun (peran Admin/Kader) ============
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  username  text not null,
  nama      text not null default '',
  role      text not null default 'kader' check (role in ('admin', 'kader')),
  aktif     boolean not null default true
);

-- Setiap akun baru otomatis punya profil. Akun PERTAMA menjadi admin dan aktif.
-- Akun berikutnya menjadi kader dan NONAKTIF sampai admin mengaktifkannya, sehingga orang luar
-- yang mendaftar sendiri tidak bisa membaca atau menulis data apa pun.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare pertama boolean;
begin
  select count(*) = 0 into pertama from public.profiles;
  insert into public.profiles (id, username, nama, role, aktif)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(nullif(new.raw_user_meta_data ->> 'nama', ''), split_part(new.email, '@', 1)),
    case when pertama then 'admin' else 'kader' end,
    pertama
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif and role = 'admin')
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_baca on public.profiles;
create policy profiles_baca on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_ubah on public.profiles;
create policy profiles_ubah on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ Data aplikasi (satu tabel umum, kunci: tabel + id) ============
create sequence if not exists public.records_seq;

create table if not exists public.records (
  tbl        text    not null check (tbl in (
               'warga','kegiatan','kunjungan','pemeriksaan','statusKhusus','layananObat',
               'imunisasi','kehamilan','audit','kategori','kv')),
  id         text    not null,
  data       jsonb   not null default '{}'::jsonb,
  deleted    boolean not null default false,
  seq        bigint  not null default nextval('public.records_seq'),
  updated_by uuid    default auth.uid(),
  primary key (tbl, id)
);
create index if not exists records_seq_idx on public.records (seq);

-- Nomor urut diberikan server setiap baris ditulis; klien menarik berdasarkan nomor ini.
-- Aturan yang tidak bisa dilewati lewat aplikasi:
--   pengaturan dan kategori hanya boleh diubah admin; warga dan kegiatan hanya boleh dihapus admin.
create or replace function public.records_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.seq := nextval('public.records_seq');
  new.updated_by := auth.uid();
  if new.tbl in ('kv', 'kategori') and not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah pengaturan' using errcode = 'P0001';
  end if;
  if new.deleted and new.tbl in ('warga', 'kegiatan') and not public.is_admin() then
    raise exception 'Hanya admin yang boleh menghapus warga atau kegiatan' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists records_guard_trg on public.records;
create trigger records_guard_trg before insert or update on public.records
  for each row execute function public.records_guard();

alter table public.records enable row level security;
drop policy if exists records_baca on public.records;
create policy records_baca on public.records for select to authenticated using (public.is_active());
drop policy if exists records_tambah on public.records;
create policy records_tambah on public.records for insert to authenticated with check (public.is_active());
drop policy if exists records_ubah on public.records;
create policy records_ubah on public.records for update to authenticated
  using (public.is_active()) with check (public.is_active());
-- Tidak ada kebijakan delete: penghapusan memakai penanda deleted=true.

-- ============ Ping untuk menjaga proyek gratis tetap aktif ============
create or replace function public.ping() returns integer
language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon, authenticated;

-- ============ Hak akses tabel ============
revoke all on public.records, public.profiles from anon;
grant select, insert, update on public.records to authenticated;
grant select, update on public.profiles to authenticated;
grant usage, select on sequence public.records_seq to authenticated;
