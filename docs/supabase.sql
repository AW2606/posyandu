-- Posyandu Bangau: skema Supabase.
-- Jalankan sekali di Supabase > SQL Editor > New query > Run.
-- Belum diuji pada proyek Supabase sungguhan. Jalankan di proyek baru dan baca pesan galatnya.

-- ============ Profil akun (peran Super admin / Admin / Kader) ============
-- superadmin : pengelola sistem (satu orang). Satu-satunya yang boleh mengelola akun admin;
--              di aplikasi juga memegang server, riwayat perubahan, dan cadangan data.
-- admin      : pengurus Posyandu. Semua urusan Posyandu: identitas, ambang, kategori, akun kader,
--              arsip dan hapus permanen warga, hapus kegiatan.
-- kader      : pelayanan harian.
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  username  text not null,
  nama      text not null default '',
  role      text not null default 'kader' check (role in ('superadmin', 'admin', 'kader')),
  aktif     boolean not null default true
);
-- proyek lama: perbarui batasan peran supaya menerima 'superadmin'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('superadmin', 'admin', 'kader'));
-- foto profil: gambar JPEG kecil (data URL) yang sudah diperkecil di perangkat
alter table public.profiles add column if not exists foto text;
alter table public.profiles drop constraint if exists profiles_foto_check;
alter table public.profiles add constraint profiles_foto_check
  check (foto is null or (foto like 'data:image/%' and length(foto) < 300000));

-- Setiap akun baru otomatis punya profil. Akun PERTAMA menjadi super admin dan aktif.
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
    case when pertama then 'superadmin' else 'kader' end,
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

-- admin ATAU super admin (wewenang pengurus)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif and role in ('admin', 'superadmin'))
$$;

-- khusus super admin
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif and role = 'superadmin')
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_baca on public.profiles;
create policy profiles_baca on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- Super admin boleh mengubah akun siapa pun. Admin hanya akun kader, dan hasilnya tetap kader
-- (admin tidak bisa menaikkan siapa pun menjadi admin/super admin, atau menyentuh akun admin lain).
drop policy if exists profiles_ubah on public.profiles;
create policy profiles_ubah on public.profiles for update to authenticated
  using (public.is_super() or (public.is_admin() and role = 'kader'))
  with check (public.is_super() or (public.is_admin() and role = 'kader'));
-- Setiap akun aktif boleh mengubah profilnya sendiri (nama dan foto). Peran, status aktif, dan
-- nama pengguna dijaga pemicu di bawah, jadi tidak bisa dinaikkan sendiri lewat jalur ini.
drop policy if exists profiles_sendiri on public.profiles;
create policy profiles_sendiri on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active()) with check (id = auth.uid());

-- Penjaga perubahan profil:
--   * super admin terakhir tidak boleh hilang (diturunkan, dinonaktifkan, atau dihapus);
--   * selain super admin, tidak ada yang bisa mengubah peran atau status aktifnya sendiri;
--   * nama pengguna hanya berubah lewat fungsi ganti_username (email login ikut diganti di sana).
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.id = auth.uid() and not public.is_super()
       and (new.role is distinct from old.role or new.aktif is distinct from old.aktif) then
      raise exception 'Tidak bisa mengubah peran atau status akun sendiri' using errcode = 'P0001';
    end if;
    if new.username is distinct from old.username
       and coalesce(current_setting('posyandu.ganti_username', true), '') <> '1' then
      raise exception 'Nama pengguna hanya bisa diganti lewat menu Profil' using errcode = 'P0001';
    end if;
  end if;
  if old.role = 'superadmin'
     and (tg_op = 'DELETE' or new.role <> 'superadmin' or not new.aktif)
     and not exists (select 1 from public.profiles where id <> old.id and role = 'superadmin' and aktif) then
    raise exception 'Super admin terakhir tidak bisa dihapus, diturunkan, atau dinonaktifkan' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update or delete on public.profiles
  for each row execute function public.profiles_guard();

-- Peralihan proyek lama: bila belum ada super admin, akun admin yang PALING AWAL terdaftar
-- (biasanya pembuat proyek) dinaikkan menjadi super admin. Tidak berbuat apa-apa bila sudah ada.
update public.profiles set role = 'superadmin', aktif = true
where not exists (select 1 from public.profiles where role = 'superadmin')
  and id = (
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'admin' order by u.created_at limit 1
  );

-- Admin menghapus akun lain dari aplikasi. Menghapus dari auth.users butuh hak server,
-- jadi dibungkus fungsi security definer yang memeriksa peran pemanggil lebih dulu.
-- Profil ikut terhapus (on delete cascade); nama pengguna bisa dipakai lagi.
create or replace function public.hapus_akun(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menghapus akun' using errcode = 'P0001';
  end if;
  if target = auth.uid() then
    raise exception 'Tidak bisa menghapus akun sendiri' using errcode = 'P0001';
  end if;
  if not public.is_super() and exists (select 1 from public.profiles where id = target and role <> 'kader') then
    raise exception 'Hanya super admin yang boleh menghapus akun admin' using errcode = 'P0001';
  end if;
  delete from auth.users where id = target;
end $$;
revoke all on function public.hapus_akun(uuid) from public, anon;
grant execute on function public.hapus_akun(uuid) to authenticated;

-- Ganti nama pengguna akun sendiri (menu Profil). Aplikasi masuk dengan email "<nama>@posyandu.local",
-- jadi email login di auth.users ikut diganti. Akun yang masuk memakai email sungguhan tidak
-- diubah emailnya; hanya nama pengguna yang tampil.
create or replace function public.ganti_username(baru text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  u text := lower(trim(baru));
  surel text := lower(trim(baru)) || '@posyandu.local';
begin
  if auth.uid() is null or not public.is_active() then
    raise exception 'Akun tidak aktif' using errcode = 'P0001';
  end if;
  if u !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Nama pengguna 3-30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where username = u and id <> auth.uid())
     or exists (select 1 from auth.users where lower(email) = surel and id <> auth.uid()) then
    raise exception 'Nama pengguna sudah dipakai.' using errcode = 'P0001';
  end if;
  update auth.users set email = surel, updated_at = now()
    where id = auth.uid() and email like '%@posyandu.local';
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(surel)), updated_at = now()
    where user_id = auth.uid() and provider = 'email' and identity_data ->> 'email' like '%@posyandu.local';
  perform set_config('posyandu.ganti_username', '1', true); -- izin sekali pakai untuk penjaga profil
  update public.profiles set username = u where id = auth.uid();
end $$;
revoke all on function public.ganti_username(text) from public, anon;
grant execute on function public.ganti_username(text) to authenticated;

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
-- Aturan yang tidak bisa dilewati lewat aplikasi ("admin" di bawah = admin atau super admin):
--   pengaturan (identitas, ambang batas) dan kategori umur hanya boleh diubah admin;
--   warga dan kegiatan hanya boleh dihapus admin;
--   mengarsipkan/memulihkan warga (mengubah data.aktif) hanya boleh admin.
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
  if tg_op = 'UPDATE' and new.tbl = 'warga'
     and (old.data -> 'aktif') is distinct from (new.data -> 'aktif')
     and not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengarsipkan atau memulihkan warga' using errcode = 'P0001';
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
