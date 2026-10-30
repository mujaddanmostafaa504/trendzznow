import { h, raw, api, money, num, fmtDate, statusPill, STATUS, PAYM, toast, fail, confirmBox } from './a-core.js';

const SRC = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', messenger: 'Messenger', google: 'Google', youtube: 'YouTube', direct: 'সরাসরি', manual: 'ম্যানুয়াল' };

export async function render(el, ctx) {
  const [d, prods] = await Promise.all([api('/dashboard'), api('/products?limit=100').catch(() => ({ items: [] }))]);
  const hasDemo = prods.items.some((p) => p.demo) || d.recentOrders.some((o) => o.demo);
  const max = Math.max(1, ...d.daily.map((x) => x.orders));
  const kpi = (t, o) => h`<div class="kpi"><span>${t}</span><b>${money(o.revenue)}</b><em>${num(o.orders)}টি অর্ডার</em></div>`;
  el.innerHTML = h`<h1>ড্যাশবোর্ড</h1>
${hasDemo ? h`<div class="alert"><b>এখন সাইটে ডেমো পণ্য ও ডেমো অর্ডার আছে।</b> নিজের পণ্য তোলার আগে ডেমো ডাটা মুছে ফেলুন, নইলে কাস্টমাররা ডেমো পণ্য দেখবে।<div style="margin-top:8px"><button class="btn btn-danger sm" data-demo>ডেমো ডাটা মুছুন</button></div></div>` : ''}
${d.productCount === 0 ? h`<div class="alert info">এখনো কোনো প্রোডাক্ট নেই। <a href="#/products/new">প্রথম প্রোডাক্ট যোগ করুন</a>।</div>` : ''}
<div class="kpis">${kpi('আজ', d.today)}${kpi('গত ৭ দিন', d.week)}${kpi('গত ৩০ দিন', d.month)}<div class="kpi"><span>৩০ দিনের লাভ (কেনা দাম দিলে)</span><b>${money(d.profit30)}</b><em>মোট ${num(d.allTime.orders)}টি অর্ডার</em></div></div>
<div class="cols"><div>
<div class="card"><h2>গত ১৪ দিনের অর্ডার</h2><div class="bars">${d.daily.map((x) => h`<div title="${x.date}: ${x.orders}টি, ${money(x.revenue)}"><i style="height:${Math.round((x.orders / max) * 100)}%"></i>${x.date.slice(8)}</div>`)}</div></div>
<div class="card"><div class="row between"><h2>সাম্প্রতিক অর্ডার</h2><a href="#/orders">সব দেখুন</a></div><div class="tw" style="border:0"><table><tbody>${d.recentOrders.map((o) => h`<tr><td><a href="#/orders/${o.number}"><b>${o.number}</b></a><br><small class="muted">${fmtDate(o.createdAt)}</small></td><td>${o.customer.name}<br><small class="muted">${o.customer.district}</small></td><td class="r">${money(o.total)}</td><td>${statusPill(o.status)}</td></tr>`)}</tbody></table></div></div>
</div><div>
<div class="card"><h2>করণীয়</h2><ul class="list"><li><span class="grow">নতুন অর্ডার</span><a href="#/orders?status=pending"><b>${d.pendingOrders}</b></a></li><li><span class="grow">রিভিউ অনুমোদনের অপেক্ষায়</span><a href="#/reviews"><b>${d.pendingReviews}</b></a></li><li><span class="grow">না-পড়া মেসেজ</span><a href="#/messages"><b>${d.unreadMessages}</b></a></li></ul></div>
<div class="card"><h2>অর্ডার কোথা থেকে (৩০ দিন)</h2>${d.sources.length ? h`<ul class="list">${d.sources.map((s) => h`<li><span class="grow">${SRC[s.source] || s.source}</span><b>${s.orders}</b><span class="muted">${money(s.revenue)}</span></li>`)}</ul>` : h`<p class="muted">এখনো অর্ডার নেই।</p>`}</div>
<div class="card"><h2>সবচেয়ে বেশি বিক্রি (৩০ দিন)</h2>${d.topProducts.length ? h`<ul class="list">${d.topProducts.map((p) => h`<li><span class="grow">${p.name}</span><b>${p.qty}টি</b></li>`)}</ul>` : h`<p class="muted">এখনো তথ্য নেই।</p>`}</div>
<div class="card"><h2>স্টক কম</h2>${d.lowStock.length ? h`<ul class="list">${d.lowStock.map((p) => h`<li><span class="grow"><a href="#/products/${p.id}">${p.name}</a></span><b class="${p.stock ? 'warn' : 'bad'}">${p.stock ? p.stock + 'টি' : 'শেষ'}</b></li>`)}</ul>` : h`<p class="muted">সব পণ্যের স্টক ঠিক আছে।</p>`}</div>
</div></div>`.s;
  const b = el.querySelector('[data-demo]');
  if (b)
    b.onclick = async () => {
      if (!(await confirmBox('ডেমো পণ্য, ব্যানার, কুপন, ক্যাটাগরি ও ডেমো অর্ডার সব মুছে যাবে। আপনার নিজের যোগ করা কিছু মুছবে না।'))) return;
      try {
        await api('/demo/delete', { method: 'POST' });
        toast('ডেমো ডাটা মুছে গেছে');
        render(el, ctx);
      } catch (e) {
        fail(e);
      }
    };
}
