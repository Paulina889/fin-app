const apiBase = '';
let authToken = localStorage.getItem('finapp_token');
let expenseChart;

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} zł`;

const apiFetch = async (path, options = {}) => {
  const headers = options.headers || {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Błąd serwera' }));
    throw new Error(error.error || 'Błąd');
  }
  return response.json();
};

const showToast = (text, color = '#111827') => {
  Toastify({
    text,
    duration: 3000,
    gravity: 'top',
    position: 'right',
    backgroundColor: color,
  }).showToast();
};

const updateClock = () => {
  const now = new Date();
  const timeString = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clock').textContent = timeString;
};

const loadSummary = async () => {
  const summary = await apiFetch('/api/summary');
  document.getElementById('incomeTotal').textContent = formatCurrency(summary.income);
  document.getElementById('expenseTotal').textContent = formatCurrency(summary.expense);
  document.getElementById('balanceTotal').textContent = formatCurrency(summary.balance);
};

const loadBudgets = async () => {
  const budgets = await apiFetch('/api/budgets');
  const list = document.getElementById('budgetList');
  list.innerHTML = '';
  budgets.forEach((budget) => {
    const item = document.createElement('li');
    item.textContent = `${budget.month}: ${formatCurrency(budget.amount)}`;
    list.appendChild(item);
  });
};

const loadCategories = async () => {
  const categories = await apiFetch('/api/categories');
  const container = document.getElementById('categoryTags');
  container.innerHTML = '';
  categories.forEach((category) => {
    const tag = document.createElement('span');
    tag.className = 'rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600';
    tag.textContent = category;
    container.appendChild(tag);
  });
};

const loadTransactions = async () => {
  const transactions = await apiFetch('/api/transactions');
  const table = document.getElementById('transactionsTable');
  table.innerHTML = '';
  transactions.forEach((transaction) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="py-2">${transaction.date}</td>
      <td class="py-2">${transaction.description || '-'}<div class="text-xs text-slate-400">${transaction.side_hustle || ''}</div></td>
      <td class="py-2">${transaction.category}</td>
      <td class="py-2 ${transaction.type === 'expense' ? 'text-rose-500' : 'text-emerald-600'}">${transaction.type === 'expense' ? '-' : '+'}${formatCurrency(transaction.amount)}</td>
      <td class="py-2 text-right"><button class="text-xs text-rose-500" data-id="${transaction.id}">Usuń</button></td>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      await apiFetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' });
      await refreshDashboard();
      showToast('Usunięto transakcję', '#dc2626');
    });
    table.appendChild(row);
  });
};

const loadAnalysis = async () => {
  const data = await apiFetch('/api/analysis');
  const ctx = document.getElementById('expenseChart');
  const labels = data.map((row) => row.category);
  const values = data.map((row) => row.total);
  if (expenseChart) {
    expenseChart.destroy();
  }
  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'],
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
    },
  });
};

const loadGoals = async () => {
  const goals = await apiFetch('/api/goals');
  const container = document.getElementById('goalList');
  container.innerHTML = '';
  goals.forEach((goal) => {
    const progress = goal.target_amount ? (goal.current_amount / goal.target_amount) * 100 : 0;
    const targetDate = new Date(goal.target_date);
    const daysLeft = Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24));
    const card = document.createElement('div');
    card.className = 'rounded-lg border p-3';
    card.innerHTML = `
      <p class="text-sm font-semibold">${goal.name}</p>
      <p class="text-xs text-slate-500">${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)}</p>
      <div class="mt-2 h-2 rounded bg-slate-100">
        <div class="h-2 rounded bg-emerald-500" style="width: ${Math.min(progress, 100)}%"></div>
      </div>
      <p class="mt-2 text-xs text-slate-500">${daysLeft} dni do celu</p>
    `;
    container.appendChild(card);
  });
};

const loadHoldItems = async () => {
  const items = await apiFetch('/api/hold-items');
  const list = document.getElementById('holdList');
  list.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between rounded border px-3 py-2';
    li.innerHTML = `<span>${item.name}</span><span class="font-semibold">${formatCurrency(item.price)}</span>`;
    list.appendChild(li);
  });
};

const loadPriorities = async () => {
  const items = await apiFetch('/api/priorities');
  const list = document.getElementById('priorityList');
  list.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'rounded border px-3 py-2';
    li.innerHTML = `<p class="font-semibold">${item.title}</p><p class="text-xs text-slate-500">${item.month}</p>`;
    list.appendChild(li);
  });
};

const loadKnowledge = async () => {
  const data = await apiFetch('/api/knowledge');
  const container = document.getElementById('knowledgeList');
  container.innerHTML = '';
  data.forEach((item) => {
    const article = document.createElement('div');
    article.className = 'rounded-lg border p-4';
    article.innerHTML = `
      <h3 class="text-sm font-semibold">${item.title}</h3>
      <p class="text-sm text-slate-600">${item.summary}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        ${item.tags.map((tag) => `<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">${tag}</span>`).join('')}
      </div>
    `;
    container.appendChild(article);
  });
};

const loadCurrency = async () => {
  const data = await apiFetch('/api/currency');
  const container = document.getElementById('currencyRates');
  container.innerHTML = `
    <p>Aktualizacja: ${data.updated}</p>
    <ul class="mt-2 space-y-1">
      ${Object.entries(data.rates)
        .map(([code, rate]) => `<li>${code}: ${rate}</li>`)
        .join('')}
    </ul>
  `;
};

let calendar;
const loadCalendar = async () => {
  const events = await apiFetch('/api/events');
  if (!calendar) {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
      plugins: [FullCalendarDayGrid],
      initialView: 'dayGridMonth',
      events,
      height: 450,
    });
    calendar.render();
  } else {
    calendar.removeAllEvents();
    events.forEach((event) => calendar.addEvent(event));
  }

  const upcoming = document.getElementById('upcomingEvents');
  upcoming.innerHTML = '';
  events
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 4)
    .forEach((event) => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between rounded border px-3 py-2 text-sm';
      li.innerHTML = `<span>${event.title}</span><span class="text-xs text-slate-500">${event.start}</span>`;
      upcoming.appendChild(li);
    });
};

const refreshDashboard = async () => {
  await Promise.all([
    loadSummary(),
    loadBudgets(),
    loadCategories(),
    loadTransactions(),
    loadAnalysis(),
    loadGoals(),
    loadHoldItems(),
    loadPriorities(),
    loadKnowledge(),
    loadCurrency(),
    loadCalendar(),
  ]);
};

const setTodayDefaults = () => {
  const today = new Date().toISOString().split('T')[0];
  document.querySelector('#transactionForm [name="date"]').value = today;
};

const setupEventHandlers = () => {
  document.getElementById('transactionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.amount = parseFloat(payload.amount);
    await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.target.reset();
    setTodayDefaults();
    await refreshDashboard();
    showToast('Dodano transakcję', '#059669');
  });

  document.getElementById('budgetForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.amount = parseFloat(payload.amount);
    await apiFetch('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.target.reset();
    await loadBudgets();
    showToast('Budżet zapisany', '#1e293b');
  });

  document.getElementById('goalForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.targetAmount = parseFloat(payload.targetAmount);
    payload.currentAmount = parseFloat(payload.currentAmount);
    await apiFetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.target.reset();
    await loadGoals();
    showToast('Dodano cel', '#111827');
  });

  document.getElementById('holdForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.price = parseFloat(payload.price);
    await apiFetch('/api/hold-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.target.reset();
    await loadHoldItems();
    showToast('Dodano do listy', '#f59e0b');
  });

  document.getElementById('priorityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    await apiFetch('/api/priorities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.target.reset();
    await loadPriorities();
    showToast('Dodano priorytet', '#6366f1');
  });

  document.getElementById('addEventBtn').addEventListener('click', async () => {
    const title = prompt('Nazwa wydarzenia');
    if (!title) return;
    const start = prompt('Data (YYYY-MM-DD)', new Date().toISOString().split('T')[0]);
    const category = prompt('Kategoria', 'Opłata');
    await apiFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify({ title, start, category }),
    });
    await loadCalendar();
    showToast('Dodano wydarzenie', '#0f172a');
  });

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      authToken = data.token;
      localStorage.setItem('finapp_token', authToken);
      showToast('Zalogowano pomyślnie', '#059669');
      await refreshDashboard();
    } catch (error) {
      showToast('Błąd logowania', '#dc2626');
    }
  });

  document.getElementById('registerBtn').addEventListener('click', async () => {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      authToken = data.token;
      localStorage.setItem('finapp_token', authToken);
      showToast('Rejestracja zakończona', '#2563eb');
      await refreshDashboard();
    } catch (error) {
      showToast('Błąd rejestracji', '#dc2626');
    }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Zmieniono hasło', '#0f172a');
      event.target.reset();
    } catch (error) {
      showToast('Błąd zmiany hasła', '#dc2626');
    }
  });

  document.getElementById('setupForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    document.getElementById('setupSummary').innerHTML = `
      <p><strong>Ulubiona kategoria:</strong> ${payload.favoriteCategory || 'brak'}</p>
      <p><strong>Cel miesięczny:</strong> ${payload.monthlyGoal || 'brak'}</p>
    `;
    showToast('Zapisano konfigurację', '#16a34a');
  });
};

updateClock();
setInterval(updateClock, 1000 * 30);
setTodayDefaults();
setupEventHandlers();
refreshDashboard();
frontend/static/styles.css
Nowość
+ 17
- 0

#calendar .fc {
  font-size: 0.85rem;
}

#calendar .fc-toolbar-title {
  font-size: 1rem;
}

#transactionsTable tr + tr {
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 640px) {
  header .text-right {
    display: none;
  }
}
frontend/templates/index.html
Nowość
+ 219
- 0

<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Finanse osobiste - dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.10/index.global.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css" />
  <link rel="stylesheet" href="/static/styles.css" />
</head>
<body class="bg-slate-50 text-slate-900">
  <header class="bg-slate-900 text-white">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <div>
        <h1 class="text-xl font-semibold">Finanse osobiste</h1>
        <p class="text-sm text-slate-300">Kontrola budżetu, oszczędzanie i planowanie</p>
      </div>
      <div class="text-right">
        <p class="text-sm">Aktualny czas</p>
        <p class="text-lg font-semibold" id="clock">00:00</p>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-6 py-8">
    <section class="grid gap-6 lg:grid-cols-3">
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Saldo vs zadłużenie</h2>
        <div class="mt-4 space-y-2">
          <p class="text-sm text-slate-500">Przychody</p>
          <p class="text-2xl font-semibold text-emerald-600" id="incomeTotal">0 zł</p>
          <p class="text-sm text-slate-500">Wydatki</p>
          <p class="text-2xl font-semibold text-rose-500" id="expenseTotal">0 zł</p>
          <p class="text-sm text-slate-500">Saldo</p>
          <p class="text-2xl font-semibold" id="balanceTotal">0 zł</p>
        </div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Nadchodzące wydarzenia</h2>
        <ul class="mt-4 space-y-2" id="upcomingEvents" aria-live="polite"></ul>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Dodaj budżet</h2>
        <form class="mt-4 space-y-3" id="budgetForm">
          <label class="block text-sm">
            Miesiąc
            <input class="mt-1 w-full rounded border px-3 py-2" type="month" name="month" required />
          </label>
          <label class="block text-sm">
            Kwota budżetu
            <input class="mt-1 w-full rounded border px-3 py-2" type="number" name="amount" min="0" step="0.01" required />
          </label>
          <button class="w-full rounded bg-slate-900 px-4 py-2 text-white" type="submit">Zapisz budżet</button>
        </form>
        <ul class="mt-4 space-y-1 text-sm text-slate-600" id="budgetList"></ul>
      </div>
    </section>

    <section class="mt-10 grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl bg-white p-6 shadow">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Kalendarz finansowy</h2>
          <button class="rounded border px-3 py-1 text-sm" id="addEventBtn">Dodaj wydarzenie</button>
        </div>
        <div class="mt-4" id="calendar"></div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Kategorie wydarzeń</h2>
        <p class="mt-2 text-sm text-slate-500">Filtruj i oznaczaj wydarzenia według typu.</p>
        <div class="mt-4 flex flex-wrap gap-2" id="categoryTags"></div>
      </div>
    </section>

    <section class="mt-10 grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Rejestr wydatków i przychodów</h2>
        <form class="mt-4 grid gap-3 sm:grid-cols-2" id="transactionForm">
          <label class="text-sm">Kwota
            <input class="mt-1 w-full rounded border px-3 py-2" type="number" name="amount" min="0" step="0.01" required />
          </label>
          <label class="text-sm">Typ
            <select class="mt-1 w-full rounded border px-3 py-2" name="type" required>
              <option value="expense">Wydatek</option>
              <option value="income">Przychód</option>
            </select>
          </label>
          <label class="text-sm">Kategoria
            <input class="mt-1 w-full rounded border px-3 py-2" type="text" name="category" required />
          </label>
          <label class="text-sm">Data
            <input class="mt-1 w-full rounded border px-3 py-2" type="date" name="date" required />
          </label>
          <label class="text-sm sm:col-span-2">Opis
            <input class="mt-1 w-full rounded border px-3 py-2" type="text" name="description" />
          </label>
          <label class="text-sm sm:col-span-2">Side hustle (opcjonalne)
            <input class="mt-1 w-full rounded border px-3 py-2" type="text" name="sideHustle" />
          </label>
          <button class="sm:col-span-2 rounded bg-emerald-500 px-4 py-2 text-white" type="submit">Dodaj transakcję</button>
        </form>
        <div class="mt-6 max-h-64 overflow-auto">
          <table class="w-full text-left text-sm">
            <thead class="sticky top-0 bg-white">
              <tr>
                <th class="pb-2">Data</th>
                <th class="pb-2">Opis</th>
                <th class="pb-2">Kategoria</th>
                <th class="pb-2">Kwota</th>
                <th class="pb-2"></th>
              </tr>
            </thead>
            <tbody id="transactionsTable"></tbody>
          </table>
        </div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Analiza wydatków</h2>
        <canvas id="expenseChart" class="mt-4"></canvas>
        <div class="mt-6 rounded-lg bg-slate-100 p-4">
          <p class="text-sm font-semibold">Cele SMART</p>
          <p class="text-sm text-slate-600">Monitoruj progres i analizuj wyniki każdego miesiąca.</p>
        </div>
      </div>
    </section>

    <section class="mt-10 grid gap-6 lg:grid-cols-3">
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Cele oszczędnościowe</h2>
        <form class="mt-4 space-y-3" id="goalForm">
          <input class="w-full rounded border px-3 py-2" type="text" name="name" placeholder="Nazwa celu" required />
          <input class="w-full rounded border px-3 py-2" type="number" name="targetAmount" min="0" step="0.01" placeholder="Kwota docelowa" required />
          <input class="w-full rounded border px-3 py-2" type="number" name="currentAmount" min="0" step="0.01" placeholder="Aktualny stan" required />
          <input class="w-full rounded border px-3 py-2" type="date" name="targetDate" required />
          <button class="w-full rounded bg-slate-900 px-4 py-2 text-white" type="submit">Dodaj cel</button>
        </form>
        <div class="mt-4 space-y-3" id="goalList"></div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Lista "na wstrzymanie"</h2>
        <form class="mt-4 space-y-3" id="holdForm">
          <input class="w-full rounded border px-3 py-2" type="text" name="name" placeholder="Planowany zakup" required />
          <input class="w-full rounded border px-3 py-2" type="number" name="price" min="0" step="0.01" placeholder="Cena" required />
          <button class="w-full rounded bg-amber-500 px-4 py-2 text-white" type="submit">Dodaj do listy</button>
        </form>
        <ul class="mt-4 space-y-2 text-sm" id="holdList"></ul>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Priorytety miesiąca</h2>
        <form class="mt-4 space-y-3" id="priorityForm">
          <input class="w-full rounded border px-3 py-2" type="text" name="title" placeholder="Cel na miesiąc" required />
          <input class="w-full rounded border px-3 py-2" type="month" name="month" required />
          <button class="w-full rounded bg-indigo-500 px-4 py-2 text-white" type="submit">Dodaj priorytet</button>
        </form>
        <ul class="mt-4 space-y-2 text-sm" id="priorityList"></ul>
      </div>
    </section>

    <section class="mt-10 grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Baza wiedzy</h2>
        <div class="mt-4 space-y-4" id="knowledgeList"></div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <h2 class="text-lg font-semibold">Kursy walut</h2>
        <div class="mt-4 text-sm text-slate-600" id="currencyRates"></div>
        <div class="mt-6 rounded-lg bg-slate-100 p-4">
          <p class="text-sm font-semibold">Podcasty i linki</p>
          <ul class="mt-2 list-disc pl-4 text-sm text-slate-600">
            <li><a class="text-blue-600 underline" href="https://www.nbp.pl" target="_blank" rel="noreferrer">NBP - dane rynkowe</a></li>
            <li><a class="text-blue-600 underline" href="https://www.money.pl" target="_blank" rel="noreferrer">Money.pl</a></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="mt-10 rounded-xl bg-white p-6 shadow">
      <div class="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 class="text-lg font-semibold">Logowanie / Rejestracja</h2>
          <form class="mt-4 space-y-3" id="loginForm" aria-label="Logowanie">
            <input class="w-full rounded border px-3 py-2" type="email" name="email" placeholder="Email" required />
            <input class="w-full rounded border px-3 py-2" type="password" name="password" placeholder="Hasło" required />
            <div class="flex gap-3">
              <button class="flex-1 rounded bg-slate-900 px-4 py-2 text-white" type="submit">Zaloguj</button>
              <button class="flex-1 rounded border px-4 py-2" type="button" id="registerBtn">Zarejestruj</button>
            </div>
          </form>
          <form class="mt-6 space-y-3" id="passwordForm">
            <input class="w-full rounded border px-3 py-2" type="password" name="currentPassword" placeholder="Aktualne hasło" required />
            <input class="w-full rounded border px-3 py-2" type="password" name="newPassword" placeholder="Nowe hasło" required />
            <button class="w-full rounded bg-rose-500 px-4 py-2 text-white" type="submit">Zmień hasło</button>
          </form>
        </div>
        <div>
          <h2 class="text-lg font-semibold">Konfiguracja startowa</h2>
          <p class="mt-2 text-sm text-slate-600">Ustaw preferencje aplikacji i pierwsze kategorie.</p>
          <form class="mt-4 space-y-3" id="setupForm">
            <input class="w-full rounded border px-3 py-2" type="text" name="favoriteCategory" placeholder="Ulubiona kategoria" />
            <input class="w-full rounded border px-3 py-2" type="text" name="monthlyGoal" placeholder="Cel oszczędnościowy" />
            <button class="w-full rounded bg-emerald-500 px-4 py-2 text-white" type="submit">Zapisz ustawienia</button>
          </form>
          <div class="mt-4 rounded-lg bg-slate-100 p-4 text-sm" id="setupSummary"></div>
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-slate-900 py-6 text-center text-sm text-slate-300">
    <p>Finanse osobiste • demonstracyjna aplikacja webowa</p>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.10/index.global.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.10/index.global.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
  <script src="/static/app.js"></script>
</body>
</html>