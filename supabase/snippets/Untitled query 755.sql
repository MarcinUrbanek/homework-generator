update public.profiles as p
set role = 'teacher'
from auth.users as u
where p.id = u.id
  and u.email = 'urbanekmarcin@poczta.onet.pl';