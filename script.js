// Supabase Setup
const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
const lookups = {};
const selected = {};

// Auth: Login
document.getElementById('login').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert('Login fehlgeschlagen.');
  user = data.user;
  document.getElementById('auth-status').textContent = `Angemeldet als ${user.email}`;
  document.getElementById('app-content').style.display = 'block';
};

// Auth: Registrierung
document.getElementById('signup').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert('Registrierung fehlgeschlagen.');
  alert('Registrierung erfolgreich – E-Mail bestätigen!');
};

// Optionen laden (z. B. Marken, Stoffe, etc.)
async function loadOptions(tableName) {
  const container = document.getElementById(tableName);
  if (!container) return;

  const { data, error } = await supabase.from(tableName).select('*');
  if (error) return console.error(`Fehler beim Laden von ${tableName}:`, error);

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
  const tables = ['clothing_types', 'brands', 'categories', 'colors', 'fabrics', 'patterns', 'fits'];
  for (let table of tables) {
    await loadOptions(table);
  }
}
loadAll();

// Neues Icon hinzufügen
document.getElementById('add-new-option').onclick = async () => {
  const table = document.getElementById('add-target').value;
  const name = document.getElementById('new-name').value;
  const icon = document.getElementById('new-icon').value;
  if (!name || !icon) return alert('Name und Icon erforderlich.');

  const column = table === 'clothing_types' ? 'label' : 'name';
  const insertData = { [column]: name, icon: icon };
  const { error } = await supabase.from(table).insert([insertData]);
  if (error) return alert('Fehler beim Hinzufügen.');

  await loadOptions(table);
  document.getElementById('new-name').value = '';
  document.getElementById('new-icon').value = '';
};

// Kleidungsstück speichern
document.getElementById('add-clothing').onclick = async () => {
  if (!user) return alert('Bitte zuerst anmelden.');

  const file = document.getElementById('clothing-image').files[0];
  let image_url = null;

  if (file) {
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('wardrobe-images')
      .upload(fileName, file);
    if (uploadError) return alert('Fehler beim Hochladen des Bildes');

    const { data: publicUrlData } = supabase.storage
      .from('wardrobe-images')
      .getPublicUrl(fileName);
    image_url = publicUrlData.publicUrl;
  }

  const item = {
    user_id: user.id,
    clothing_type_id: selected.clothing_types,
    brand_id: selected.brands,
    category_id: selected.categories,
    color_id: selected.colors,
    fabric_id: selected.fabrics,
    pattern_id: selected.patterns,
    fit_id: selected.fits,
    image_url
  };

  if (Object.values(item).some(v => !v)) return alert('Bitte alle Felder auswählen.');
  const { error } = await supabase.from('wardrobe_items').insert([item]);
  if (error) return alert('Fehler beim Speichern: ' + error.message);

  alert('Kleidungsstück gespeichert.');
  document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('clothing-image').value = '';
};

// 🎲 Outfit Generator (inkl. Debug-Logs)
const REQUIRED_CATEGORIES = {
  top: ['Oberteil', 'Einteiler'],
  bottom: ['Unterteil', 'Einteiler'],
  shoes: ['Schuhe'],
  socks: ['Socken'],
  accessories: ['Accessoire']
};

function interpretCategoryFromOccasion(text) {
  const t = text.toLowerCase();
  if (t.includes('hochzeit') || t.includes('abend')) return 'Elegant';
  if (t.includes('büro') || t.includes('arbeit')) return 'Business';
  if (t.includes('sport')) return 'Sportlich';
  return 'Casual';
}

function findItemByCategory(items, group) {
  return items.find(item => {
    const label = lookups.clothing_types[item.clothing_type_id]?.label;
    return group.includes(label);
  });
}

document.getElementById('generate-outfit').onclick = async () => {
  if (!user) return alert('Bitte anmelden.');

  const occasion = document.getElementById('occasion').value;
  const categoryName = interpretCategoryFromOccasion(occasion);
  const category = Object.values(lookups.categories).find(c => c.name === categoryName);

  console.log('🧠 Anlass:', occasion);
  console.log('🧩 Erkannte Kategorie:', categoryName);
  if (!category) {
    alert(`Kategorie "${categoryName}" nicht gefunden.`);
    return;
  }

  const { data: ownItems, error: loadError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', category.id);

  if (loadError) {
    console.error('❌ Fehler beim Laden eigener Kleidungsstücke:', loadError);
    alert('Fehler beim Laden deiner Kleidung.');
    return;
  }

  console.log('🧺 Eigene Kleidungsstücke:', ownItems);

  const outfit = {};
  for (let [key, group] of Object.entries(REQUIRED_CATEGORIES)) {
    const found = findItemByCategory(ownItems, group);
    outfit[key] = found || null;
    if (found) {
      console.log(`✅ Eigener Treffer für "${key}":`, found);
    } else {
      console.log(`❌ Kein eigenes Teil für "${key}"`);
    }
  }

  let foreignUsed = false;

  if (Object.values(outfit).some(i => !i)) {
    console.log('🔁 Suche fehlende Teile bei anderen Nutzern...');

    const { data: others, error: otherErr } = await supabase
      .from('wardrobe_items')
      .select('*')
      .neq('user_id', user.id)
      .eq('category_id', category.id);

    if (otherErr) {
      console.error('❌ Fehler beim Laden anderer Kleidungsstücke:', otherErr);
    }

    for (let [key, group] of Object.entries(REQUIRED_CATEGORIES)) {
      if (!outfit[key]) {
        const found = findItemByCategory(others, group);
        if (found) {
          outfit[key] = found;
          foreignUsed = true;
          console.log(`🔄 Fremder Treffer für "${key}":`, found);
        } else {
          console.log(`🚫 Auch bei anderen kein Treffer für "${key}"`);
        }
      }
    }
  }

  const result = document.getElementById('outfit-result');
  result.innerHTML = `<h3>Outfit für "${occasion}":</h3>`;

  if (foreignUsed) {
    const warning = document.createElement('p');
    warning.textContent = '⚠️ Teile stammen von anderen Nutzern.';
    warning.style.color = 'red';
    result.appendChild(warning);
  }

  if (Object.values(outfit).every(i => i)) {
    for (const key in outfit) {
      const item = outfit[key];
      const label = lookups.clothing_types[item.clothing_type_id]?.label || key;
      const brand = lookups.brands[item.brand_id]?.name || '';
      const p = document.createElement('p');
      p.textContent = `${label}${brand ? ' – ' + brand : ''}`;

      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = label;
        img.style.maxWidth = '100px';
        img.style.marginBottom = '0.5rem';
        result.appendChild(img);
      }

      result.appendChild(p);
    }
  } else {
    const p = document.createElement('p');
    p.textContent = '❌ Kein vollständiges Outfit gefunden.';
    p.style.color = 'gray';
    result.appendChild(p);
  }
};
