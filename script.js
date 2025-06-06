const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
const lookups = {};

document.getElementById('login').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert('Login fehlgeschlagen');
  user = data.user;
  document.getElementById('auth-status').textContent = `Angemeldet als ${user.email}`;
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
  if (val.includes('hochzeit') || val.includes('abend')) return 'Elegant';
  if (val.includes('büro') || val.includes('arbeit')) return 'Business';
  if (val.includes('freunde') || val.includes('spazieren')) return 'Casual';
  return 'Casual';
}

async function loadOptions(table, targetId) {
  const { data } = await supabase.from(table).select('*');
  data.forEach(item => {
    lookups[table] = lookups[table] || {};
    lookups[table][item.id] = item;
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.icon || ''} ${item.label || item.name}`;
    document.getElementById(targetId).appendChild(opt);
  });
}

async function loadAllLookups() {
  await Promise.all([
    loadOptions('clothing_types', 'clothing_type_id'),
    loadOptions('brands', 'brand_id'),
    loadOptions('categories', 'category_id'),
    loadOptions('colors', 'color_id'),
    loadOptions('fabrics', 'fabric_id'),
    loadOptions('patterns', 'pattern_id'),
    loadOptions('fits', 'fit_id')
  ]);
}
loadAllLookups();

document.getElementById('add-clothing-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!user) return alert('Bitte zuerst anmelden.');
  const fields = ['clothing_type_id', 'brand_id', 'category_id', 'color_id', 'fabric_id', 'pattern_id', 'fit_id'];
  const data = { user_id: user.id };
  fields.forEach(id => data[id] = document.getElementById(id).value);
  const { error } = await supabase.from('wardrobe_items').insert([data]);
  if (error) return alert('Fehler beim Hinzufügen');
  alert('Kleidungsstück hinzugefügt');
  e.target.reset();
});

document.getElementById('generate-outfit').onclick = async () => {
  if (!user) return alert('Bitte anmelden');
  const input = document.getElementById('occasion').value;
  const categoryLabel = interpretCategoryFromOccasion(input);
  const categoryEntry = Object.values(lookups.categories).find(c => c.name === categoryLabel);
  if (!categoryEntry) return alert('Kategorie nicht gefunden');

  const { data } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', categoryEntry.id);

  if (!data.length) return alert('Keine Kleidung für diesen Anlass gefunden');

  const resultDiv = document.getElementById('outfit-result');
  resultDiv.innerHTML = `<h3>Outfit-Vorschlag für "${input}":</h3>`;
  data.forEach(item => {
    const type = lookups.clothing_types[item.clothing_type_id]?.label || 'Typ';
    const brand = lookups.brands[item.brand_id]?.name || 'Marke';
    const color = lookups.colors[item.color_id]?.name || 'Farbe';
    const fabric = lookups.fabrics[item.fabric_id]?.name || 'Stoff';
    const pattern = lookups.patterns[item.pattern_id]?.name || 'Muster';
    const fit = lookups.fits[item.fit_id]?.name || 'Schnitt';
    const p = document.createElement('p');
    p.textContent = `${type} | ${brand} | ${color} | ${fabric} | ${pattern} | ${fit}`;
    resultDiv.appendChild(p);
  });
};
