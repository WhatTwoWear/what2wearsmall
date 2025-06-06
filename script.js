const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
const lookups = {};
const selected = {};

document.getElementById('login').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert('Login fehlgeschlagen');
  user = data.user;
  document.getElementById('auth-status').textContent = `Angemeldet als ${user.email}`;
  document.getElementById('app-content').style.display = 'block';
};

document.getElementById('signup').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert('Registrierung fehlgeschlagen');
  alert('Registrierung erfolgreich. Bitte E-Mail bestätigen.');
};

function interpretCategoryFromOccasion(text) {
  const val = text.toLowerCase();
  if (val.includes('sport')) return 'Sportlich';
  if (val.includes('hochzeit')) return 'Elegant';
  if (val.includes('büro')) return 'Business';
  return 'Casual';
}

async function loadOptions(table) {
  const { data } = await supabase.from(table).select('*');
  lookups[table] = {};
  const container = document.getElementById(table);
  data.forEach(item => {
    lookups[table][item.id] = item;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.innerHTML = item.icon + '<br>' + (item.label || item.name);
    btn.onclick = () => {
      selected[table] = item.id;
      [...container.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    container.appendChild(btn);
  });
}

async function loadAll() {
  await loadOptions('clothing_types');
  await loadOptions('brands');
  await loadOptions('categories');
  await loadOptions('colors');
  await loadOptions('fabrics');
  await loadOptions('patterns');
  await loadOptions('fits');
}
loadAll();

document.getElementById('add-clothing').onclick = async () => {
  if (!user) return alert('Bitte anmelden.');
  const item = {
    user_id: user.id,
    clothing_type_id: selected.clothing_types,
    brand_id: selected.brands,
    category_id: selected.categories,
    color_id: selected.colors,
    fabric_id: selected.fabrics,
    pattern_id: selected.patterns,
    fit_id: selected.fits
  };
  const { error } = await supabase.from('wardrobe_items').insert([item]);
  if (error) return alert('Fehler beim Speichern');
  alert('Kleidungsstück gespeichert!');
};

document.getElementById('generate-outfit').onclick = async () => {
  if (!user) return alert('Bitte anmelden.');
  const occasion = document.getElementById('occasion').value;
  const catName = interpretCategoryFromOccasion(occasion);
  const category = Object.values(lookups.categories).find(c => c.name === catName);
  if (!category) return alert('Kategorie nicht gefunden');

  const { data } = await supabase.from('wardrobe_items').select('*').eq('user_id', user.id).eq('category_id', category.id);
  const result = document.getElementById('outfit-result');
  result.innerHTML = `<h3>Outfit für "${occasion}":</h3>`;
  data.forEach(item => {
    const out = [
      lookups.clothing_types[item.clothing_type_id]?.label,
      lookups.brands[item.brand_id]?.name,
      lookups.colors[item.color_id]?.name,
      lookups.fabrics[item.fabric_id]?.name,
      lookups.patterns[item.pattern_id]?.name,
      lookups.fits[item.fit_id]?.name
    ].filter(Boolean).join(" | ");
    const p = document.createElement('p');
    p.textContent = out;
    result.appendChild(p);
  });
};
