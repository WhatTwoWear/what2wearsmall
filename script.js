// Supabase Initialisierung
const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
const lookups = {};
const selected = {};

// Auth
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
  alert('Bitte E-Mail bestätigen.');
};

// Auswahl laden
async function loadOptions(table) {
  const container = document.getElementById(table);
  if (!container) return;
  const { data } = await supabase.from(table).select('*');
  lookups[table] = {};
  container.innerHTML = '';
  data.forEach(item => {
    lookups[table][item.id] = item;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.innerHTML = `<div>${item.icon || '❔'}</div><small>${item.label || item.name}</small>`;
    btn.onclick = () => {
      selected[table] = item.id;
      [...container.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    container.appendChild(btn);
  });
}

async function loadAll() {
  const tables = ['clothing_types', 'brands', 'categories', 'colors', 'fabrics', 'patterns', 'fits'];
  for (let t of tables) await loadOptions(t);
}
loadAll();

// Neuen Eintrag hinzufügen
document.getElementById('add-new-option').onclick = async () => {
  const table = document.getElementById('add-target').value;
  const name = document.getElementById('new-name').value;
  const icon = document.getElementById('new-icon').value;
  if (!name || !icon) return alert('Name und Icon erforderlich');
  const column = table === 'clothing_types' ? 'label' : 'name';
  const { error } = await supabase.from(table).insert([{ [column]: name, icon }]);
  if (error) return alert('Fehler beim Hinzufügen');
  await loadOptions(table);
};

// Kleidung speichern
document.getElementById('add-clothing').onclick = async () => {
  if (!user) return alert('Bitte anmelden');
  const file = document.getElementById('clothing-image').files[0];
  let image_url = null;
  if (file) {
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('wardrobe-images').upload(path, file);
    if (uploadError) return alert('Fehler beim Bild-Upload');
    const { data } = supabase.storage.from('wardrobe-images').getPublicUrl(path);
    image_url = data.publicUrl;
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

  if (Object.values(item).some(v => !v && v !== null)) return alert('Bitte alle Felder auswählen');
  const { error } = await supabase.from('wardrobe_items').insert([item]);
  if (error) return alert('Fehler beim Speichern: ' + error.message);
  alert('Gespeichert');
  document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('clothing-image').value = '';
};

// Anlass in Kategorie umwandeln
function interpretCategoryFromOccasion(text) {
  const t = text.toLowerCase();
  if (t.includes('hochzeit') || t.includes('abend')) return 'Elegant';
  if (t.includes('büro') || t.includes('arbeit')) return 'Business';
  if (t.includes('sport')) return 'Sportlich';
  return 'Casual';
}

// Outfit generieren
const REQUIRED_CATEGORIES = {
  top: ['Oberteil', 'Einteiler'],
  bottom: ['Unterteil', 'Einteiler'],
  shoes: ['Schuhe'],
  socks: ['Socken'],
  accessories: ['Accessoire']
};

function findItemByCategory(items, group) {
  return items.find(i => group.includes(lookups.clothing_types[i.clothing_type_id]?.category));
}

document.getElementById('generate-outfit').onclick = async () => {
  if (!user) return alert('Bitte anmelden');
  const occasion = document.getElementById('occasion').value;
  const catName = interpretCategoryFromOccasion(occasion);
  const category = Object.values(lookups.categories).find(c => c.name === catName);
  if (!category) return alert('Kategorie nicht gefunden');

  const { data: ownItems } = await supabase.from('wardrobe_items').select('*').eq('user_id', user.id).eq('category_id', category.id);
  const { data: otherItems } = await supabase.from('wardrobe_items').select('*').neq('user_id', user.id).eq('category_id', category.id);

  const outfit = {};
  let foreignUsed = false;

  for (let [key, group] of Object.entries(REQUIRED_CATEGORIES)) {
    const pool = ownItems.filter(i => group.includes(lookups.clothing_types[i.clothing_type_id]?.category));
    if (pool.length) {
      outfit[key] = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const alt = otherItems.filter(i => group.includes(lookups.clothing_types[i.clothing_type_id]?.category));
      if (alt.length) {
        outfit[key] = alt[Math.floor(Math.random() * alt.length)];
        foreignUsed = true;
      } else {
        outfit[key] = null;
      }
    }
  }

  const result = document.getElementById('outfit-result');
  result.innerHTML = `<h3>Outfit für "${occasion}":</h3>`;
  if (foreignUsed) {
    const warn = document.createElement('p');
    warn.textContent = '⚠️ Teile stammen von anderen Nutzern';
    warn.style.color = 'red';
    result.appendChild(warn);
  }

  const currentOutfit = {};
  for (const key in REQUIRED_CATEGORIES) {
    const item = outfit[key];
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const p = document.createElement('p');
    if (item) {
      p.textContent = `${label}: ${lookups.clothing_types[item.clothing_type_id]?.label || key}`;
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.style.maxWidth = '100px';
        result.appendChild(img);
      }
    } else {
      p.textContent = `🚫 Kein ${label} gefunden`;
      p.style.color = 'gray';
    }
    result.appendChild(p);
    currentOutfit[key] = item;
  }

  // Like Button
  const likeBtn = document.createElement('button');
  likeBtn.textContent = '❤️ Outfit speichern';
  likeBtn.onclick = async () => {
    await supabase.from('liked_outfits').insert([{ user_id: user.id, items: currentOutfit }]);
    alert('Gespeichert!');
  };
  result.appendChild(likeBtn);

  // Datum speichern
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.id = 'plan-date';
  result.appendChild(dateInput);

  const planBtn = document.createElement('button');
  planBtn.textContent = '📅 Outfit für Datum speichern';
  planBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) return alert('Bitte Datum wählen');
    await supabase.from('planned_outfits').insert([{ user_id: user.id, planned_date: date, items: currentOutfit }]);
    alert(`Outfit für ${date} gespeichert.`);
  };
  result.appendChild(planBtn);
};

// Geplante Outfits anzeigen
document.getElementById('load-day').onclick = async () => {
  const d = document.getElementById('calendar-date').value;
  if (!d) return alert('Datum wählen');
  const { data } = await supabase.from('planned_outfits').select('*').eq('user_id', user.id).eq('planned_date', d).limit(1);
  const res = document.getElementById('calendar-result');
  res.innerHTML = '';
  if (!data || !data.length) return res.textContent = 'Kein Outfit geplant.';
  const outfit = data[0].items;
  for (const key in outfit) {
    const item = outfit[key];
    const p = document.createElement('p');
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    if (item) {
      p.textContent = `${label}: ${lookups.clothing_types[item.clothing_type_id]?.label || key}`;
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.style.maxWidth = '80px';
        res.appendChild(img);
      }
    } else {
      p.textContent = `${label}: —`;
      p.style.color = 'gray';
    }
    res.appendChild(p);
  }
};

// Liked Outfits anzeigen
document.getElementById('load-liked').onclick = async () => {
  const { data } = await supabase.from('liked_outfits').select('*').eq('user_id', user.id);
  const container = document.getElementById('liked-outfits');
  container.innerHTML = '';
  if (!data.length) return container.textContent = 'Keine gespeicherten Outfits.';
  data.forEach(outfit => {
    const div = document.createElement('div');
    div.style.marginBottom = '1rem';
    for (const key in outfit.items) {
      const item = outfit.items[key];
      const p = document.createElement('p');
      if (item) {
        p.textContent = `${key}: ${lookups.clothing_types[item.clothing_type_id]?.label || key}`;
        if (item.image_url) {
          const img = document.createElement('img');
          img.src = item.image_url;
          img.style.maxWidth = '80px';
          div.appendChild(img);
        }
      } else {
        p.textContent = `${key}: —`;
        p.style.color = 'gray';
      }
      div.appendChild(p);
    }
    container.appendChild(div);
  });
};
