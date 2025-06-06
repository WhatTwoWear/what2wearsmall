const { createClient } = supabase;

const SUPABASE_URL = 'https://crwtuozpzgykmcocpkwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3R1b3pwemd5a21jb2Nwa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTU4MjksImV4cCI6MjA2NDE5MTgyOX0.-U59i0IWdbZhqGhSWzBoLV--uzuFWPbJgwKLNUkx9yM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const userId = 'demo-user-id';

function interpretCategoryFromOccasion(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('sport')) return 'Sportlich';
  if (normalized.includes('hochzeit') || normalized.includes('abend')) return 'Elegant';
  if (normalized.includes('büro') || normalized.includes('arbeit')) return 'Business';
  if (normalized.includes('freunde') || normalized.includes('spazieren') || normalized.includes('park')) return 'Casual';
  if (normalized.includes('konzert') || normalized.includes('hip hop')) return 'Streetwear';
  return 'Casual';
}

let categories = {};
let brands = {};
async function loadLookups() {
  const [catRes, brandRes] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('brands').select('*')
  ]);
  catRes.data.forEach(cat => categories[cat.name] = cat.id);
  brandRes.data.forEach(b => {
    brands[b.id] = b.name;
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.icon || ''} ${b.name}`;
    document.getElementById('brand').appendChild(opt);
  });
  catRes.data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icon || ''} ${c.name}`;
    document.getElementById('category').appendChild(opt);
  });
}
loadLookups();

document.getElementById('add-clothing-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('clothing-type').value;
  const brand = document.getElementById('brand').value;
  const category = document.getElementById('category').value;

  const { error } = await supabase.from('wardrobe_items').insert([{
    user_id: userId,
    clothing_type: type,
    brand_id: brand,
    category_id: category
  }]);

  if (error) alert('Fehler beim Speichern');
  else {
    alert('Hinzugefügt!');
    document.getElementById('add-clothing-form').reset();
  }
});

document.getElementById('generate-outfit').addEventListener('click', async () => {
  const occasion = document.getElementById('occasion').value;
  const categoryName = interpretCategoryFromOccasion(occasion);
  const categoryId = categories[categoryName];

  if (!categoryId) return alert('Kategorie nicht gefunden.');

  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .eq('category_id', categoryId);

  if (error || !data.length) return alert('Keine passenden Teile gefunden.');

  const grouped = {};
  data.forEach(item => {
    if (!grouped[item.clothing_type]) grouped[item.clothing_type] = [];
    grouped[item.clothing_type].push(item);
  });

  const resultDiv = document.getElementById('outfit-result');
  resultDiv.innerHTML = `<h3>Dein Outfit für "${occasion}":</h3>`;

  for (const [type, items] of Object.entries(grouped)) {
    const pick = items[Math.floor(Math.random() * items.length)];
    const brandName = brands[pick.brand_id] || 'Unbekannt';
    const line = document.createElement('p');
    line.textContent = `${type}: ${pick.clothing_type} (${brandName})`;
    resultDiv.appendChild(line);
  }

  const date = document.getElementById('calendar').value;
  if (date) {
    const log = document.createElement('p');
    log.textContent = `✔ Outfit für ${date} gespeichert.`;
    resultDiv.appendChild(log);
  }
});
