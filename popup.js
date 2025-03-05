// Utility Functions
const getDomain = (url) => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (e) {
        return 'Unknown';
    }
};

// Tab Management
class TabManager {
    constructor() {
        this.tabs = [];
        this.domainCounts = {};
        this.initializeEventListeners();
    }

    async loadTabs() {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                this.tabs = tabs.map(tab => ({
                    ...tab,
                    domain: getDomain(tab.url),
                    selected: false,
                    timestamp: Date.now()
                }));

                // Count domains
                this.domainCounts = this.tabs.reduce((acc, tab) => {
                    acc[tab.domain] = (acc[tab.domain] || 0) + 1;
                    return acc;
                }, {});

                this.populateDomainFilter();
                this.renderTabs();
                resolve(this.tabs);
            });
        });
    }

    populateDomainFilter() {
        const domainFilter = document.getElementById('domainFilter');
        Object.keys(this.domainCounts).forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = `${domain} (${this.domainCounts[domain]})`;
            domainFilter.appendChild(option);
        });
    }

    renderTabs() {
        const tabsList = document.getElementById('tabsList');
        tabsList.innerHTML = '';

        const windowFilter = document.getElementById('windowFilter').value;
        const domainFilter = document.getElementById('domainFilter').value;
        const timeFilter = document.getElementById('timeFilter').value;
        const sortBy = document.getElementById('sortBy').value;

        let filteredTabs = this.tabs.filter(tab => {
            // Window filter
            if (windowFilter === 'current' && !tab.active) return false;

            // Domain filter
            if (domainFilter !== 'all' && tab.domain !== domainFilter) return false;

            // Time filter
            const now = Date.now();
            switch (timeFilter) {
                case '1hour':
                    return now - tab.timestamp <= 3600000;
                case '24hours':
                    return now - tab.timestamp <= 86400000;
                case 'week':
                    return now - tab.timestamp <= 604800000;
                default:
                    return true;
            }
        });

        // Sorting
        switch (sortBy) {
            case 'title':
                filteredTabs.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'url':
                filteredTabs.sort((a, b) => a.url.localeCompare(b.url));
                break;
            case 'domain':
                filteredTabs.sort((a, b) => a.domain.localeCompare(b.domain));
                break;
        }

        filteredTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'flex items-center p-2 border-b hover:bg-gray-200';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = tab.selected;
            checkbox.className = 'mr-2';
            checkbox.addEventListener('change', () => {
                tab.selected = checkbox.checked;
            });

            const label = document.createElement('label');
            label.className = 'flex-grow truncate';
            label.innerHTML = `
          <span class="font-bold">${tab.title}</span>
          <br>
          <small class="text-gray-500">${tab.url}</small>
        `;

            tabElement.appendChild(checkbox);
            tabElement.appendChild(label);
            tabsList.appendChild(tabElement);
        });
    }

    initializeEventListeners() {
        document.getElementById('windowFilter').addEventListener('change', () => this.renderTabs());
        document.getElementById('domainFilter').addEventListener('change', () => this.renderTabs());
        document.getElementById('timeFilter').addEventListener('change', () => this.renderTabs());
        document.getElementById('sortBy').addEventListener('change', () => this.renderTabs());

        // Export Buttons
        document.getElementById('exportMarkdown').addEventListener('click', () => this.exportTabs('markdown'));
        document.getElementById('exportCSV').addEventListener('click', () => this.exportTabs('csv'));
        document.getElementById('exportJSON').addEventListener('click', () => this.exportTabs('json'));
        document.getElementById('exportHTML').addEventListener('click', () => this.exportTabs('html'));
        document.getElementById('exportBookmarks').addEventListener('click', () => this.exportTabs('bookmarks'));
        document.getElementById('exportText').addEventListener('click', () => this.exportTabs('text'));

        // Advanced Actions
        document.getElementById('selectAll').addEventListener('click', () => {
            this.tabs.forEach(tab => tab.selected = true);
            this.renderTabs();
        });

        document.getElementById('deselectAll').addEventListener('click', () => {
            this.tabs.forEach(tab => tab.selected = false);
            this.renderTabs();
        });

        document.getElementById('closeSelected').addEventListener('click', () => {
            const selectedTabIds = this.tabs
                .filter(tab => tab.selected)
                .map(tab => tab.id);

            selectedTabIds.forEach(tabId => chrome.tabs.remove(tabId));
            this.loadTabs();
        });

        document.getElementById('bookmarkSelected').addEventListener('click', () => {
            this.tabs
                .filter(tab => tab.selected)
                .forEach(tab => {
                    chrome.bookmarks.create({
                        title: tab.title,
                        url: tab.url
                    });
                });
        });
    }

    exportTabs(format) {
        const selectedTabs = this.tabs.filter(tab => tab.selected);
        let content = '';

        switch (format) {
            case 'markdown':
                content = "| Title | URL | Domain |\n|-------|-----|--------|\n" +
                    selectedTabs.map(tab =>
                        `| ${tab.title.replace(/\|/g, '\\|')} | ${tab.url} | ${tab.domain} |`
                    ).join('\n');
                this.downloadFile(content, 'tabs.md', 'text/markdown');
                break;

            case 'csv':
                content = "Title,URL,Domain\n" +
                    selectedTabs.map(tab =>
                        `"${tab.title.replace(/"/g, '""')}","${tab.url}","${tab.domain}"`
                    ).join('\n');
                this.downloadFile(content, 'tabs.csv', 'text/csv');
                break;

            case 'json':
                content = JSON.stringify(selectedTabs.map(tab => ({
                    title: tab.title,
                    url: tab.url,
                    domain: tab.domain
                })), null, 2);
                this.downloadFile(content, 'tabs.json', 'application/json');
                break;

            case 'html':
                content = `
  <!DOCTYPE html>
  <html>
  <head><title>Exported Tabs</title></head>
  <body>
    <h1>Exported Tabs</h1>
    <table border="1">
      <tr><th>Title</th><th>URL</th><th>Domain</th></tr>
      ${selectedTabs.map(tab => `
        <tr>
          <td>${tab.title}</td>
          <td><a href="${tab.url}">${tab.url}</a></td>
          <td>${tab.domain}</td>
        </tr>
      `).join('')}
    </table>
  </body>
  </html>`;
                this.downloadFile(content, 'tabs.html', 'text/html');
                break;

            case 'bookmarks':
                selectedTabs.forEach(tab => {
                    chrome.bookmarks.create({
                        title: tab.title,
                        url: tab.url
                    });
                });
                break;

            case 'text':
                content = selectedTabs.map(tab =>
                    `Title: ${tab.title}\nURL: ${tab.url}\nDomain: ${tab.domain}\n---`
                ).join('\n\n');
                this.downloadFile(content, 'tabs.txt', 'text/plain');
                break;
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        }, () => {
            URL.revokeObjectURL(url);
        });
    }
}

// Initialize Tab Manager
document.addEventListener('DOMContentLoaded', () => {
    const tabManager = new TabManager();
    tabManager.loadTabs();
});