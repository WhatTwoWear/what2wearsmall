// Supabase-Verbindung
const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Statusvariablen
let user = null;
const lookups = {};
const selected = {};

// 🔐 Login
document.getElementById('login').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Login fehlgeschlagen');
    console.error(error);
    return;
  }

  user = data.user;
  document.getElementById('auth-status').textContent = `Angemeldet als ${user.email}`;
  document.getElementById('app-content').style.display = 'block';
};

// 🔐 Registrierung
document.getElementById('signup').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    alert('Registrierung fehlgeschlagen');
    console.error(error);
    return;
  }

  alert('Registrierung erfolgreich. Bitte E-Mail bestätigen.');
};

// 👗 Icon-Optionen laden
async function loadOptions(tableName) {
  const container = document.getElementById(tableName);
  if (!container) return;

  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`Fehler beim Laden von ${tableName}:`, error);
    return;
  }

  lookups[tableName] = {};
  container.innerHTML = '';

  data.forEach(item => {
    lookups[tableName][item.id] = item;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.innerHTML = `<div>${item.icon || '❔'}</div><small>${item.label || item.name}</small>`;
    btn.onclick = () => {
      selected[tableName] = item.id;
      [...container.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };

    container.appendChild(btn);
  });
}

async function loadAll() {
  const tables = [
    'clothing_types',
    'brands',
    'categories',
    'colors',
    'fabrics',
    'patterns',
    'fits'
  ];

  for (let table of tables) {
    await loadOptions(table);
  }
}
loadAll();

// ➕ Neues Icon hinzufügen
document.getElementById('add-new-option').onclick = async () => {
  const table = document.getElementById('add-target').value;
  const name = document.getElementById('new-name').value;
  const icon = document.getElementById('new-icon').value;

  if (!name || !icon) return alert('Bitte Name und Icon angeben.');

  const column = table === 'clothing_types' ? 'label' : 'name';
  const insertData = {};
  insertData[column] = name;
  insertData.icon = icon;

  const { error } = await supabase.from(table).insert([insertData]);
  if (error) {
    alert('Fehler beim Hinzufügen');
    console.error(error);
  } else {
    alert(`Hinzugefügt zu ${table}`);
    document.getElementById('new-name').value = '';
    document.getElementById('new-icon').value = '';
    await loadOptions(table);
  }
};

// 💾 Kleidung speichern
document.getElementById('add-clothing').onclick = async () => {
  if (!user) return alert('Bitte zuerst anmelden.');

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

  if (Object.values(item).some(v => !v)) {
    alert('Bitte wähle alle Optionen aus.');
    return;
  }

  const { error } = await supabase.from('wardrobe_items').insert([item]);
  if (error) {
    console.error(error);
    alert('Fehler beim Speichern: ' + error.message);
  } else {
    alert('Kleidungsstück erfolgreich hinzugefügt!');
    Object.keys(selected).forEach(k => selected[k] = null);
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
  }
};

// 🎲 Anlass interpretieren → Kategorie
function interpretCategoryFromOccasion(text) {
  const t = text.toLowerCase();
  if (t.includes('hochzeit') || t.includes('abend')) return 'Elegant';
  if (t.includes('büro') || t.includes('arbeit')) return 'Business';
  if (t.includes('sport')) return 'Sportlich';
  return 'Casual';
}

// 🧠 Outfit-Vorschlag generieren
document.getElementById('generate-outfit').onclick = async () => {
  if (!user) return alert('Bitte anmelden.');

  const occasionText = document.getElementById('occasion').value;
  const categoryName = interpretCategoryFromOccasion(occasionText);
  const categoryEntry = Object.values(lookups.categories).find(c => c.name === categoryName);

  if (!categoryEntry) {
    alert('Keine passende Kategorie gefunden.');
    return;
  }

  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', categoryEntry.id);

  if (error || !data.length) {
    alert('Keine Kleidungsstücke für diesen Anlass gefunden.');
    return;
  }

  const resultBox = document.getElementById('outfit-result');
  resultBox.innerHTML = `<h3>Outfit-Vorschlag für "${occasionText}":</h3>`;

  data.forEach(item => {
    const row = [
      lookups.clothing_types[item.clothing_type_id]?.label,
      lookups.brands[item.brand_id]?.name,
      lookups.colors[item.color_id]?.name,
      lookups.fabrics[item.fabric_id]?.name,
      lookups.patterns[item.pattern_id]?.name,
      lookups.fits[item.fit_id]?.name
    ].filter(Boolean).join(" | ");

    const p = document.createElement('p');
    p.textContent = row;
    resultBox.appendChild(p);
  });
};
