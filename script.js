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

// Auswahloptionen laden
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

// Neues Icon
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

// Kleidungsstück speichern
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

// Anlass zu Kategorie
function interpretCategoryFromOccasion(text) {
  const t = text.toLowerCase();
  if (t.includes('hochzeit') || t.includes('abend')) return 'Elegant';
  if (t.includes('büro') || t.includes('arbeit')) return 'Business';
  if (t.includes('sport')) return 'Sportlich';
  return 'Casual';
}

// Outfit-Logik
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
      const typeLabel = lookups.clothing_types[item.clothing_type_id]?.label || key;
      const brand = lookups.brands[item.brand_id]?.name || '';
      p.textContent = `${label}: ${typeLabel}${brand ? ' – ' + brand : ''}`;
      currentOutfit[key] = item;
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.style.maxWidth = '100px';
        result.appendChild(img);
      }
    } else {
      p.textContent = `🚫 Kein ${label} gefunden`;
      p.style.color = 'gray';
      currentOutfit[key] = null;
    }

    result.appendChild(p);
  }

  const likeBtn = document.createElement('button');
  likeBtn.textContent = '❤️ Outfit speichern';
  likeBtn.onclick = async () => {
    const { error } = await supabase.from('liked_outfits').insert([{ user_id: user.id, items: currentOutfit }]);
    if (error) alert('Fehler beim Speichern: ' + error.message);
    else alert('Outfit gespeichert!');
  };
  result.appendChild(likeBtn);
};
