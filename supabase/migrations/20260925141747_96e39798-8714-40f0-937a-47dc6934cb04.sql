create or replace function public.public_portfolio_leaderboard()
returns table(share_code text, portfolio_name text, holdings_count int, return_pct numeric, views_count int)
language sql stable security definer set search_path = public as $$
  select sp.share_code, p.name, count(h.id)::int,
    case when sum(h.shares*h.avg_price) > 0
      then round(((sum(h.shares*coalesce(h.current_price,h.avg_price)) / sum(h.shares*h.avg_price)) - 1) * 100, 2)
      else 0 end,
    coalesce(sp.views_count,0)::int
  from shared_portfolios sp
  join portfolios p on p.id = sp.portfolio_id
  left join holdings h on h.portfolio_id = p.id and h.shares > 0
  where sp.is_public = true and sp.share_code is not null
  group by sp.share_code, p.name, sp.views_count
  having count(h.id) > 0
  order by 4 desc
  limit 50
$$;
grant execute on function public.public_portfolio_leaderboard() to anon, authenticated;