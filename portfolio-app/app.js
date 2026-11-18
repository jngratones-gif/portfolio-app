import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// ---------- 1. Firebase setup: PASTE YOUR OWN VALUES HERE ----------
const firebaseConfig = {
  apiKey: "AIzaSyC-D-4TB1sK2HnKCGxnxNzvnATgof99t0g",
  authDomain: "portfolio-app-f9b87.firebaseapp.com",
  projectId: "portfolio-app-f9b87",
  storageBucket: "portfolio-app-f9b87.firebasestorage.app",
  messagingSenderId: "710732287060",
  appId: "1:710732287060:web:c85f9a8b1c593c60e571c1",
  measurementId: "G-3V2GSBBFB7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const projectsRef = collection(db, 'projects');

const CATEGORIES = ['Web', 'Systems', 'Brand / Logo', 'Automation'];

// ---------- 2. Page elements ----------
const form = document.querySelector('#project-form');
const formTitle = document.querySelector('#form-title');
const idInput = document.querySelector('#project-id');
const titleInput = document.querySelector('#title');
const categoryInput = document.querySelector('#category');
const descriptionInput = document.querySelector('#description');
const tagsInput = document.querySelector('#tags');
const linkInput = document.querySelector('#link');
const imageInput = document.querySelector('#image');
const imagePreview = document.querySelector('#image-preview');
const featuredInput = document.querySelector('#featured');
const saveBtn = document.querySelector('#save-btn');
const cancelBtn = document.querySelector('#cancel-btn');
const searchInput = document.querySelector('#search');
const listEl = document.querySelector('#project-list');
const countEl = document.querySelector('#count');
const tabsEl = document.querySelector('#tabs');

let projects = [];          // live copy of the Firestore collection
let activeCategory = 'All';
let currentImage = '';      // thumbnail of the project being edited

function fillCategoryOptions() {
  CATEGORIES.forEach((name) => {
    categoryInput.add(new Option(name, name));
  });
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------- 3. Thumbnails: resize in the browser, store as text ----------
// Firestore documents are limited to 1 MiB, so we shrink the image first.
function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Show a preview as soon as a file is chosen
imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  try {
    imagePreview.src = await resizeImage(file);
    imagePreview.hidden = false;
  } catch (error) {
    alert(error.message);
    imageInput.value = '';
  }
});

// ---------- 4. Read: live updates from Firestore ----------
const projectsQuery = query(projectsRef, orderBy('createdAt', 'desc'));

onSnapshot(
  projectsQuery,
  (snapshot) => {
    projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabs();
    render();
  },
  (error) => {
    countEl.textContent = 'Could not load projects: ' + error.message;
  }
);

function getVisibleProjects() {
  const text = searchInput.value.trim().toLowerCase();

  let list = activeCategory === 'All'
    ? projects
    : projects.filter((p) => p.category === activeCategory);

  if (text) {
    list = list.filter((p) =>
      (p.title || '').toLowerCase().includes(text) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(text))
    );
  }
  return list;
}

function render() {
  const visible = getVisibleProjects();
  countEl.textContent = `${visible.length} project(s)`;

  if (visible.length === 0) {
    listEl.innerHTML = '<p class="empty">No projects yet.</p>';
    return;
  }

  listEl.innerHTML = visible.map((p) => `
    <article class="project">
      ${p.image && p.image.startsWith('data:image/')
        ? `<img class="thumb" src="${p.image}" alt="${escapeHTML(p.title)}" />`
        : ''}
      <span class="badge">${escapeHTML(p.category)}</span>
      <h3>${p.featured ? '⭐ ' : ''}${escapeHTML(p.title)}</h3>
      <p>${escapeHTML(p.description)}</p>
      <p class="tags">${(p.tags || []).map((t) => `<span>#${escapeHTML(t)}</span>`).join('')}</p>
      ${p.link && p.link.startsWith('http')
        ? `<a href="${escapeHTML(p.link)}" target="_blank" rel="noopener">View project</a>`
        : ''}
      <div class="actions">
        <button data-action="edit" data-id="${p.id}">Edit</button>
        <button data-action="delete" data-id="${p.id}" class="danger">Delete</button>
      </div>
    </article>
  `).join('');
}

// ---------- 5. Category tabs with counts ----------
function tabLabel(name) {
  return name === 'All' ? 'All work' : name;
}

function renderTabs() {
  const names = ['All', ...CATEGORIES];
  const counts = { All: projects.length };
  CATEGORIES.forEach((name) => {
    counts[name] = projects.filter((p) => p.category === name).length;
  });

  tabsEl.innerHTML = names.map((name) => `
    <button type="button" class="tab ${name === activeCategory ? 'active' : ''}"
            data-tab="${escapeHTML(name)}">${escapeHTML(tabLabel(name))} (${counts[name]})</button>
  `).join('');
}

tabsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');
  if (!button) return;
  activeCategory = button.dataset.tab;
  renderTabs();
  render();
});

// ---------- 6. Form helpers ----------
function startEdit(project) {
  idInput.value = project.id;
  titleInput.value = project.title;
  categoryInput.value = project.category;
  descriptionInput.value = project.description || '';
  tagsInput.value = (project.tags || []).join(', ');
  linkInput.value = project.link || '';
  featuredInput.checked = Boolean(project.featured);
  currentImage = project.image || '';
  imageInput.value = '';
  imagePreview.src = currentImage;
  imagePreview.hidden = !currentImage;
  formTitle.textContent = 'Edit project';
  cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  idInput.value = '';
  currentImage = '';
  imagePreview.hidden = true;
  imagePreview.removeAttribute('src');
  formTitle.textContent = 'Add a project';
  cancelBtn.hidden = true;
}

// ---------- 7. Create and Update ----------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveBtn.disabled = true;

  try {
    // Use a newly chosen image, otherwise keep the existing one
    const file = imageInput.files[0];
    const image = file ? await resizeImage(file) : currentImage;

    const data = {
      title: titleInput.value.trim(),
      category: categoryInput.value,
      description: descriptionInput.value.trim(),
      tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
      link: linkInput.value.trim(),
      image,
      featured: featuredInput.checked
    };

    const id = idInput.value;
    if (id) {
      await updateDoc(doc(db, 'projects', id), data);
    } else {
      await addDoc(projectsRef, { ...data, createdAt: Date.now() });
    }

    resetForm();
  } catch (error) {
    alert('Could not save: ' + error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------- 8. Edit and Delete buttons ----------
listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === 'edit') {
    startEdit(projects.find((p) => p.id === id));
  }

  if (button.dataset.action === 'delete' && confirm('Delete this project?')) {
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      alert('Could not delete: ' + error.message);
    }
  }
});

cancelBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', render);

// ---------- Start ----------
fillCategoryOptions();
renderTabs();