let filmsData = [];
let filteredData = [];
let currentSort = { column: 'box_office', direction: 'desc' };
let selectedCountries = new Set();
let selectedLanguages = new Set();
let selectedCompany = null; // изменено: теперь хранит название выбранной компании или null
let charts = { country: null, language: null, year: null, company: null };

function formatMoney(value) {
    if (value === undefined || value === null) return '—';
    let num = Number(value);
    if (isNaN(num)) return value;
    if (num >= 1e9) return (num / 1e9).toFixed(2) + ' bn';
    if (num >= 1e6) return (num / 1e6).toFixed(0) + ' mn';
    return num.toLocaleString();
}

function formatList(str) {
    if (!str || str === '—') return '—';
    if (str.includes('<br>')) return str;
    const items = str.split('\t').filter(s => s.trim().length > 0);
    if (items.length === 0) return '—';
    return items.map(item => escapeHtml(item.trim())).join('<br>');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getUniqueValuesFromTabSeparated(data, field) {
    const valuesSet = new Set();
    data.forEach(item => {
        const str = item[field];
        if (str && typeof str === 'string') {
            str.split('\t').forEach(v => {
                const trimmed = v.trim();
                if (trimmed) valuesSet.add(trimmed);
            });
        }
    });
    return Array.from(valuesSet).sort();
}

async function loadData() {
    try {
        const response = await fetch('output.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.json();
        console.log('Data loaded, sample:', raw[0]);
        filmsData = raw.map(item => ({
            id: item.id,
            title: item.title || '',
            release_year: item.release_year ? Number(item.release_year) : null,
            languages: item.languages || '',
            directors: item.directors || '',
            production_companies: item.production_companies || '',
            country: item.country || '',
            box_office: item.box_office ? Number(item.box_office) : 0
        }));
        populateFilters();
        applyFiltersAndRender();
    } catch (err) {
        console.error(err);
        let msg = '❌ Error loading output.json. ';
        if (window.location.protocol === 'file:') msg += 'Please run a local server (python -m http.server)';
        else msg += 'Make sure output.json is in the same folder.';
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" class="no-data">${msg}</td></tr>`;
    }
}

function populateFilters() {
    // Страны
    const countries = [...new Set(filmsData.map(f => f.country).filter(c => c && c !== '—'))].sort();
    const countriesContainer = document.getElementById('countriesList');
    countriesContainer.innerHTML = '';
    countries.forEach(country => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.innerHTML = `
            <input type="checkbox" value="${escapeHtml(country)}" id="country_${escapeHtml(country)}">
            <label for="country_${escapeHtml(country)}">${escapeHtml(country)}</label>
        `;
        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) selectedCountries.add(country);
            else selectedCountries.delete(country);
            updateDropdownButtonText('selectedCountriesText', selectedCountries, 'All countries');
            applyFiltersAndRender();
        });
        countriesContainer.appendChild(div);
    });

    // Языки
    const languages = getUniqueValuesFromTabSeparated(filmsData, 'languages');
    const languagesContainer = document.getElementById('languagesList');
    languagesContainer.innerHTML = '';
    languages.forEach(lang => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.innerHTML = `
            <input type="checkbox" value="${escapeHtml(lang)}" id="lang_${escapeHtml(lang)}">
            <label for="lang_${escapeHtml(lang)}">${escapeHtml(lang)}</label>
        `;
        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) selectedLanguages.add(lang);
            else selectedLanguages.delete(lang);
            updateDropdownButtonText('selectedLanguagesText', selectedLanguages, 'All languages');
            applyFiltersAndRender();
        });
        languagesContainer.appendChild(div);
    });

    // Производственные компании (кастомный dropdown, одиночный выбор)
    const companies = getUniqueValuesFromTabSeparated(filmsData, 'production_companies');
    const companiesContainer = document.getElementById('companiesList');
    companiesContainer.innerHTML = '';
    
    // Добавляем пункт "All companies"
    const allItem = document.createElement('div');
    allItem.className = 'dropdown-item no-checkbox';
    allItem.textContent = 'All companies';
    allItem.addEventListener('click', () => {
        selectedCompany = null;
        updateCompanyButtonText();
        applyFiltersAndRender();
        // Закрыть меню
        const menu = document.getElementById('companyDropdown').querySelector('.dropdown-menu');
        menu.classList.remove('open');
        document.querySelector('#companyDropdown .dropdown-arrow').classList.remove('open');
    });
    companiesContainer.appendChild(allItem);
    
    companies.forEach(comp => {
        const div = document.createElement('div');
        div.className = 'dropdown-item no-checkbox';
        div.textContent = comp;
        div.addEventListener('click', () => {
            selectedCompany = comp;
            updateCompanyButtonText();
            applyFiltersAndRender();
            // Закрыть меню
            const menu = document.getElementById('companyDropdown').querySelector('.dropdown-menu');
            menu.classList.remove('open');
            document.querySelector('#companyDropdown .dropdown-arrow').classList.remove('open');
        });
        companiesContainer.appendChild(div);
    });

    updateDropdownButtonText('selectedCountriesText', selectedCountries, 'All countries');
    updateDropdownButtonText('selectedLanguagesText', selectedLanguages, 'All languages');
    updateCompanyButtonText();
}

function updateCompanyButtonText() {
    const span = document.getElementById('selectedCompanyText');
    if (!selectedCompany) {
        span.textContent = 'All companies';
    } else {
        span.textContent = selectedCompany;
    }
}

function updateDropdownButtonText(elementId, selectedSet, defaultText) {
    const span = document.getElementById(elementId);
    const count = selectedSet.size;
    if (count === 0) span.textContent = defaultText;
    else if (count === 1) span.textContent = Array.from(selectedSet)[0];
    else span.textContent = `Selected: ${count}`;
}

function syncCheckboxes(containerId, selectedSet) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.dropdown-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = selectedSet.has(checkbox.value);
    });
}

function selectAll(selectedSet, containerId, textElementId, defaultText) {
    const items = (containerId === 'countriesList')
        ? [...new Set(filmsData.map(f => f.country).filter(c => c && c !== '—'))]
        : getUniqueValuesFromTabSeparated(filmsData, 'languages');
    selectedSet.clear();
    items.forEach(item => selectedSet.add(item));
    syncCheckboxes(containerId, selectedSet);
    updateDropdownButtonText(textElementId, selectedSet, defaultText);
    applyFiltersAndRender();
}

function clearAll(selectedSet, containerId, textElementId, defaultText) {
    selectedSet.clear();
    syncCheckboxes(containerId, selectedSet);
    updateDropdownButtonText(textElementId, selectedSet, defaultText);
    applyFiltersAndRender();
}

function filterData() {
    const search = document.getElementById('searchTitle').value.trim().toLowerCase();
    const yearFrom = document.getElementById('yearFrom').value;
    const yearTo = document.getElementById('yearTo').value;

    return filmsData.filter(film => {
        if (search && !film.title.toLowerCase().includes(search)) return false;
        if (selectedCountries.size > 0 && !selectedCountries.has(film.country)) return false;
        if (selectedLanguages.size > 0) {
            const filmLanguages = film.languages ? film.languages.split('\t').map(l => l.trim()) : [];
            const hasLanguage = filmLanguages.some(lang => selectedLanguages.has(lang));
            if (!hasLanguage) return false;
        }
        if (selectedCompany !== null) {
            const filmCompanies = film.production_companies ? film.production_companies.split('\t').map(c => c.trim()) : [];
            if (!filmCompanies.includes(selectedCompany)) return false;
        }
        if (yearFrom && film.release_year < Number(yearFrom)) return false;
        if (yearTo && film.release_year > Number(yearTo)) return false;
        return true;
    });
}

function sortData(data, column, direction) {
    return [...data].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (column === 'box_office' || column === 'release_year') {
            valA = valA === null || valA === undefined ? (column === 'box_office' ? 0 : -Infinity) : Number(valA);
            valB = valB === null || valB === undefined ? (column === 'box_office' ? 0 : -Infinity) : Number(valB);
            return direction === 'asc' ? valA - valB : valB - valA;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        }
    });
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">🎞️ No films found</td></tr>';
        document.getElementById('stats').innerText = 'Films: 0';
        return;
    }
    document.getElementById('stats').innerText = `Films: ${data.length}`;
    tbody.innerHTML = data.map(film => `
        <tr>
            <td><strong>${escapeHtml(film.title)}</strong></td>
            <td>${film.release_year || '—'}</td>
            <td class="list-cell">${formatList(film.languages)}</td>
            <td class="list-cell">${formatList(film.directors)}</td>
            <td class="list-cell">${formatList(film.production_companies)}</td>
            <td>${escapeHtml(film.country) || '—'}</td>
            <td class="box-office">${formatMoney(film.box_office)}</td>
        </tr>
    `).join('');
}

function computeCountryAvg(data) {
    const map = new Map();
    data.forEach(film => {
        const country = film.country;
        if (!country || country === '—') return;
        const box = film.box_office;
        if (!map.has(country)) map.set(country, { sum: 0, count: 0 });
        const entry = map.get(country);
        entry.sum += box;
        entry.count += 1;
    });
    const entries = Array.from(map.entries()).map(([country, {sum, count}]) => ({ name: country, avg: sum / count }));
    entries.sort((a,b) => b.avg - a.avg);
    return entries.slice(0, 10);
}

function computeLanguageAvg(data) {
    const map = new Map();
    data.forEach(film => {
        const langStr = film.languages;
        if (!langStr) return;
        const languages = langStr.split('\t').map(l => l.trim()).filter(l => l);
        const box = film.box_office;
        languages.forEach(lang => {
            if (!map.has(lang)) map.set(lang, { sum: 0, count: 0 });
            const entry = map.get(lang);
            entry.sum += box;
            entry.count += 1;
        });
    });
    const entries = Array.from(map.entries()).map(([lang, {sum, count}]) => ({ name: lang, avg: sum / count }));
    entries.sort((a,b) => b.avg - a.avg);
    return entries.slice(0, 10);
}

function computeYearData(data) {
    const yearMap = new Map();
    data.forEach(film => {
        const year = film.release_year;
        if (!year) return;
        if (!yearMap.has(year)) yearMap.set(year, { count: 0, sum: 0 });
        const entry = yearMap.get(year);
        entry.count += 1;
        entry.sum += film.box_office;
    });
    const sortedYears = Array.from(yearMap.keys()).sort((a,b) => a - b);
    const counts = sortedYears.map(y => yearMap.get(y).count);
    const sums = sortedYears.map(y => yearMap.get(y).sum / 1e9);
    return { years: sortedYears, counts, sums };
}

function computeCompanyTotal(data) {
    const map = new Map();
    data.forEach(film => {
        const compStr = film.production_companies;
        if (!compStr) return;
        const companies = compStr.split('\t').map(c => c.trim()).filter(c => c);
        const box = film.box_office;
        companies.forEach(comp => {
            if (!map.has(comp)) map.set(comp, 0);
            map.set(comp, map.get(comp) + box);
        });
    });
    const entries = Array.from(map.entries()).map(([name, total]) => ({ name, total }));
    entries.sort((a,b) => b.total - a.total);
    return entries.slice(0, 10);
}

function destroyCharts() {
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
}

function updateCharts(data) {
    if (!data.length) {
        destroyCharts();
        charts = { country: null, language: null, year: null, company: null };
        return;
    }
    destroyCharts();

    const countryData = computeCountryAvg(data);
    if (countryData.length) {
        const ctx = document.getElementById('countryChart').getContext('2d');
        charts.country = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: countryData.map(d => d.name),
                datasets: [{
                    label: 'Average Box Office (bn $)',
                    data: countryData.map(d => d.avg / 1e9),
                    backgroundColor: 'rgba(201, 160, 61, 0.6)',
                    borderColor: '#c9a03d',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: true,
                plugins: { legend: { labels: { color: '#f3e9c0' } } },
                scales: { y: { ticks: { color: '#f3e9c0' }, title: { display: true, text: 'bn $', color: '#cfb87c' } },
                          x: { ticks: { color: '#f3e9c0', maxRotation: 45, minRotation: 45 } } }
            }
        });
    }

    const langData = computeLanguageAvg(data);
    if (langData.length) {
        const ctx = document.getElementById('languageChart').getContext('2d');
        charts.language = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: langData.map(d => d.name),
                datasets: [{
                    label: 'Average Box Office (bn $)',
                    data: langData.map(d => d.avg / 1e9),
                    backgroundColor: 'rgba(80, 160, 80, 0.6)',
                    borderColor: '#50a050',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: true,
                plugins: { legend: { labels: { color: '#f3e9c0' } } },
                scales: { y: { ticks: { color: '#f3e9c0' }, title: { display: true, text: 'bn $', color: '#cfb87c' } },
                          x: { ticks: { color: '#f3e9c0', maxRotation: 45, minRotation: 45 } } }
            }
        });
    }

    const yearData = computeYearData(data);
    if (yearData.years.length) {
        const ctx = document.getElementById('yearChart').getContext('2d');
        charts.year = new Chart(ctx, {
            type: 'line',
            data: {
                labels: yearData.years,
                datasets: [
                    { label: 'Number of films', data: yearData.counts, borderColor: '#e8c77e', tension: 0.3, fill: false, yAxisID: 'y-count' },
                    { label: 'Total Box Office (bn $)', data: yearData.sums, borderColor: '#c97e2e', tension: 0.3, fill: false, yAxisID: 'y-revenue' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { labels: { color: '#f3e9c0' } } },
                scales: {
                    'y-count': { position: 'left', ticks: { color: '#f3e9c0' }, title: { display: true, text: 'Count', color: '#cfb87c' } },
                    'y-revenue': { position: 'right', ticks: { color: '#f3e9c0' }, title: { display: true, text: 'bn $', color: '#cfb87c' } },
                    x: { ticks: { color: '#f3e9c0', maxRotation: 45, minRotation: 45 } }
                }
            }
        });
    }

    const companyData = computeCompanyTotal(data);
    if (companyData.length) {
        const ctx = document.getElementById('companyChart').getContext('2d');
        charts.company = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: companyData.map(d => d.name),
                datasets: [{
                    label: 'Total Box Office (bn $)',
                    data: companyData.map(d => d.total / 1e9),
                    backgroundColor: 'rgba(60, 100, 160, 0.6)',
                    borderColor: '#3c64a0',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { labels: { color: '#f3e9c0' } } },
                scales: { x: { ticks: { color: '#f3e9c0' }, title: { display: true, text: 'bn $', color: '#cfb87c' } },
                          y: { ticks: { color: '#f3e9c0' } } }
            }
        });
    }
}

function applyFiltersAndRender() {
    let filtered = filterData();
    filtered = sortData(filtered, currentSort.column, currentSort.direction);
    filteredData = filtered;
    renderTable(filteredData);
    updateCharts(filteredData);
}

function bindEvents() {
    document.getElementById('searchTitle').addEventListener('input', applyFiltersAndRender);
    document.getElementById('yearFrom').addEventListener('input', applyFiltersAndRender);
    document.getElementById('yearTo').addEventListener('input', applyFiltersAndRender);
    
    // Настройка выпадающих списков
    function setupDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        const button = dropdown.querySelector('.dropdown-button');
        const menu = dropdown.querySelector('.dropdown-menu');
        const arrow = dropdown.querySelector('.dropdown-arrow');
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('open');
            if (arrow) arrow.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                menu.classList.remove('open');
                if (arrow) arrow.classList.remove('open');
            }
        });
    }
    setupDropdown('countryDropdown');
    setupDropdown('languageDropdown');
    setupDropdown('companyDropdown');

    document.getElementById('selectAllCountriesBtn').addEventListener('click', () =>
        selectAll(selectedCountries, 'countriesList', 'selectedCountriesText', 'All countries'));
    document.getElementById('clearCountriesBtn').addEventListener('click', () =>
        clearAll(selectedCountries, 'countriesList', 'selectedCountriesText', 'All countries'));
    document.getElementById('selectAllLanguagesBtn').addEventListener('click', () =>
        selectAll(selectedLanguages, 'languagesList', 'selectedLanguagesText', 'All languages'));
    document.getElementById('clearLanguagesBtn').addEventListener('click', () =>
        clearAll(selectedLanguages, 'languagesList', 'selectedLanguagesText', 'All languages'));
    document.getElementById('clearCompanyBtn').addEventListener('click', () => {
        selectedCompany = null;
        updateCompanyButtonText();
        applyFiltersAndRender();
        const menu = document.getElementById('companyDropdown').querySelector('.dropdown-menu');
        menu.classList.remove('open');
        document.querySelector('#companyDropdown .dropdown-arrow').classList.remove('open');
    });

    document.querySelectorAll('th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-column');
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = col;
                currentSort.direction = 'desc';
            }
            applyFiltersAndRender();
        });
    });
}

loadData().then(bindEvents);