// Общая «база» демо. В демо она живёт в браузере (localStorage) и синхронизируется между вкладками
// через BroadcastChannel — так Mini App и «основной сайт» видят изменения друг друга мгновенно.
// В боевом проекте на этом месте — API сайта (REST) + WebSocket/SSE для реального времени.
(function () {
  const KEY = 'obyava_demo_v1';
  const CATS = [
    { id: 'all', name: 'Все', icon: '🗂️' },
    { id: 'auto', name: 'Авто', icon: '🚗' },
    { id: 'realty', name: 'Недвижимость', icon: '🏠' },
    { id: 'tech', name: 'Электроника', icon: '📱' },
    { id: 'home', name: 'Дом и сад', icon: '🪴' },
    { id: 'jobs', name: 'Работа', icon: '💼' },
    { id: 'services', name: 'Услуги', icon: '🛠️' },
    { id: 'kids', name: 'Детям', icon: '🧸' },
  ];
  const GRAD = {
    auto: ['#3a7bd5', '#00d2ff'], realty: ['#f7971e', '#ffd200'], tech: ['#8e2de2', '#4a00e0'],
    home: ['#11998e', '#38ef7d'], jobs: ['#434343', '#7f8c8d'], services: ['#e65c00', '#f9d423'],
    kids: ['#ff6a88', '#ff99ac'],
  };
  const now = Date.now(), H = 3600e3;
  const SEED = [
    { cat: 'auto', title: 'Hyundai Solaris 2017, 1.6 АКПП', price: 1050000, city: 'Новороссийск', desc: 'Один владелец, сервисная книжка, не бита. Зимняя резина в подарок.', author: 'Андрей', ago: 0.4 },
    { cat: 'realty', title: '1-к квартира, 38 м², сдаю на длительный срок', price: 28000, unit: '/мес', city: 'Новороссийск', desc: 'Южный район, 5/9 этаж, мебель и техника. Без животных.', author: 'Ирина', ago: 1.2 },
    { cat: 'tech', title: 'iPhone 13, 128 ГБ, синий', price: 41000, city: 'Краснодар', desc: 'Аккумулятор 88%, полный комплект, чек. Без сколов.', author: 'Максим', ago: 2.5 },
    { cat: 'home', title: 'Диван угловой, раскладной', price: 12000, city: 'Новороссийск', desc: 'Самовывоз, 3 этаж без лифта. Состояние хорошее.', author: 'Ольга', ago: 3.1 },
    { cat: 'jobs', title: 'Требуется продавец-консультант', price: 45000, unit: '/мес', city: 'Новороссийск', desc: 'График 2/2, официальное оформление, обучение.', author: 'Магазин «Сфера»', ago: 4.8 },
    { cat: 'services', title: 'Ремонт стиральных машин на дому', price: 800, prefix: 'от ', city: 'Новороссийск', desc: 'Выезд в день обращения, гарантия 6 месяцев.', author: 'Сергей', ago: 6 },
    { cat: 'kids', title: 'Коляска 2 в 1, почти новая', price: 15500, city: 'Анапа', desc: 'Пользовались 4 месяца, всё работает, дождевик в комплекте.', author: 'Наталья', ago: 9 },
    { cat: 'tech', title: 'Ноутбук Lenovo IdeaPad, Ryzen 5, 16 ГБ', price: 32000, city: 'Новороссийск', desc: 'Для учёбы и работы, SSD 512 ГБ, зарядка в комплекте.', author: 'Денис', ago: 20 },
  ];

  function seed() {
    return SEED.map((s, i) => ({
      id: 'a' + (i + 1), cat: s.cat, title: s.title, price: s.price, unit: s.unit || '', prefix: s.prefix || '',
      city: s.city, desc: s.desc, author: s.author, photo: '', status: 'active', source: i % 3 === 0 ? 'tg' : 'site',
      createdAt: now - s.ago * H, views: 12 + ((i * 37) % 140), mine: false,
    }));
  }
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.ads)) return d; } catch (e) {}
    return { ads: seed(), fav: [] };
  }
  let db = load();
  let ch = null; try { ch = new BroadcastChannel(KEY); } catch (e) {}
  const subs = [];
  function save(evt) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    if (ch) ch.postMessage(evt || { type: 'change' });
    subs.forEach(f => f(evt || { type: 'change' }, true));
  }
  function reloadFromOutside(evt) { db = load(); subs.forEach(f => f(evt || { type: 'change' }, false)); }
  if (ch) ch.onmessage = e => reloadFromOutside(e.data);
  window.addEventListener('storage', e => { if (e.key === KEY) reloadFromOutside(); });

  window.Store = {
    CATS, GRAD,
    all: () => db.ads.slice().sort((a, b) => b.createdAt - a.createdAt),
    get: id => db.ads.find(a => a.id === id),
    isFav: id => db.fav.includes(id),
    toggleFav(id) { db.fav = db.fav.includes(id) ? db.fav.filter(x => x !== id) : db.fav.concat(id); save({ type: 'fav' }); },
    add(ad) {
      const a = Object.assign({ id: 'u' + Date.now(), createdAt: Date.now(), views: 0, status: 'moderation', mine: true }, ad);
      db.ads.push(a); save({ type: 'new', id: a.id, source: a.source }); return a;
    },
    setStatus(id, status) { const a = this.get(id); if (a) { a.status = status; save({ type: 'status', id, status }); } },
    remove(id) { db.ads = db.ads.filter(a => a.id !== id); save({ type: 'remove', id }); },
    view(id) { const a = this.get(id); if (a) { a.views++; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} } },
    reset() { db = { ads: seed(), fav: [] }; save({ type: 'reset' }); },
    subscribe: f => subs.push(f),
    price(a) { return a.cat === 'jobs' && !a.price ? 'по договорённости' : (a.prefix || '') + Number(a.price).toLocaleString('ru-RU') + ' ₽' + (a.unit || ''); },
    ago(t) {
      const m = Math.round((Date.now() - t) / 60000);
      if (m < 1) return 'только что'; if (m < 60) return m + ' мин назад';
      const h = Math.round(m / 60); if (h < 24) return h + ' ч назад';
      return Math.round(h / 24) + ' дн назад';
    },
    cover(a) {
      if (a.photo) return `url("${a.photo}") center/cover`;
      const g = GRAD[a.cat] || ['#999', '#ccc'];
      return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
    },
    icon: cat => (CATS.find(c => c.id === cat) || {}).icon || '📦',
    catName: cat => (CATS.find(c => c.id === cat) || {}).name || '',
  };
})();
