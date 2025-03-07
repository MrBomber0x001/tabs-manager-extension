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
        this.searchInitialized = false;
        this.setupOfflineSupport();
        this.initializeEventListeners();
    }

    setupOfflineSupport() {
        // Inline critical Tailwind CSS for offline use
        const inlinedCSS = `
        *,::after,::before{box-sizing:border-box;border:0 solid}
        .container{width:100%;margin-right:auto;margin-left:auto;padding-right:1rem;padding-left:1rem}
        .bg-gray-100{background-color:#f3f4f6}
        .p-4{padding:1rem}
        .text-2xl{font-size:1.5rem;line-height:2rem}
        .mb-4{margin-bottom:1rem}
        .grid{display:grid}
        .grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
        .gap-2{gap:0.5rem}
        .p-2{padding:0.5rem}
        .border{border-width:1px}
        .rounded{border-radius:0.25rem}
        .text-white{color:#fff}
        .bg-blue-500{background-color:#3b82f6}
      `;

        const styleEl = document.createElement('style');
        styleEl.textContent = inlinedCSS;
        document.head.appendChild(styleEl);
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
                // Only initialize search if not already done
                if (!this.searchInitialized) {
                    this.initializeSearchFeature();
                }

                // Add duplicate detection
                this.createDuplicateSection();

                // Add tab grouping section
                this.createTabGroupingSection();

                resolve(this.tabs);
            });
        });
    }

    populateDomainFilter() {
        const domainFilter = document.getElementById('domainFilter');
        domainFilter.innerHTML = '<option value="all">All Domains</option>';
        Object.keys(this.domainCounts).forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = `${domain} (${this.domainCounts[domain]})`;
            domainFilter.appendChild(option);
        });
    }

    initializeSearchFeature() {
        // Check if search has already been initialized
        if (this.searchInitialized) return;

        const tabsListContainer = document.getElementById('tabsList');

        // Check if search input already exists
        if (document.getElementById('tabSearchInput')) return;

        const searchContainer = document.createElement('div');
        searchContainer.className = 'mb-4';

        const searchInput = document.createElement('input');
        searchInput.id = 'tabSearchInput'; // Add an ID for easy reference
        searchInput.type = 'text';
        searchInput.placeholder = 'Search tabs...';
        searchInput.className = 'w-full p-2 border rounded';

        searchContainer.appendChild(searchInput);

        // Insert search input at the top of the tabs list container
        tabsListContainer.parentNode.insertBefore(searchContainer, tabsListContainer);

        // Advanced search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();

            const searchResults = this.tabs.filter(tab => {
                const matchesTitle = tab.title.toLowerCase().includes(searchTerm);
                const matchesUrl = tab.url.toLowerCase().includes(searchTerm);
                const matchesDomain = tab.domain.toLowerCase().includes(searchTerm);

                return matchesTitle || matchesUrl || matchesDomain;
            });

            // Render search results
            this.renderTabs(searchResults);
        });

        // Mark search as initialized
        this.searchInitialized = true;
    }

    applyFilters(windowFilter, domainFilter, timeFilter, sortBy) {
        let filteredTabs = this.tabs;

        // Window filter
        if (windowFilter === 'current') {
            filteredTabs = filteredTabs.filter(tab => tab.active);
        }

        // Domain filter
        if (domainFilter !== 'all') {
            filteredTabs = filteredTabs.filter(tab => tab.domain === domainFilter);
        }

        // Time filter
        const now = Date.now();
        switch (timeFilter) {
            case '1hour':
                filteredTabs = filteredTabs.filter(tab => now - tab.timestamp <= 3600000);
                break;
            case '24hours':
                filteredTabs = filteredTabs.filter(tab => now - tab.timestamp <= 86400000);
                break;
            case 'week':
                filteredTabs = filteredTabs.filter(tab => now - tab.timestamp <= 604800000);
                break;
        }

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

        return filteredTabs;
    }

    renderTabs(preFilteredTabs = null) {
        const tabsList = document.getElementById('tabsList');
        tabsList.innerHTML = '';

        // Use provided preFilteredTabs or apply current filters
        let filteredTabs = preFilteredTabs;
        if (!filteredTabs) {
            const windowFilter = document.getElementById('windowFilter').value;
            const domainFilter = document.getElementById('domainFilter').value;
            const timeFilter = document.getElementById('timeFilter').value;
            const sortBy = document.getElementById('sortBy').value;

            filteredTabs = this.applyFilters(windowFilter, domainFilter, timeFilter, sortBy);
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
          <span class="font-bold">${this.escapeHtml(tab.title)}</span>
          <br>
          <small class="text-gray-500">${this.escapeHtml(tab.url)}</small>
        `;

            tabElement.appendChild(checkbox);
            tabElement.appendChild(label);
            tabsList.appendChild(tabElement);
        });
    }

    // Utility method to escape HTML to prevent XSS
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

        if (selectedTabs.length === 0) {
            alert('Please select at least one tab to export.');
            return;
        }

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
          <td>${this.escapeHtml(tab.title)}</td>
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

    // Advanced Search Method
    searchTabs(options = {}) {
        const {
            title = '',
            url = '',
            domain = '',
            minTabCount = 0,
            maxTabCount = Infinity,
            openedAfter = null,
            openedBefore = null
        } = options;

        return this.tabs.filter(tab => {
            const matchesTitle = title ? tab.title.toLowerCase().includes(title.toLowerCase()) : true;
            const matchesUrl = url ? tab.url.toLowerCase().includes(url.toLowerCase()) : true;
            const matchesDomain = domain ? tab.domain.toLowerCase().includes(domain.toLowerCase()) : true;

            // More advanced filtering options
            const matchesTabCount = this.domainCounts[tab.domain] >= minTabCount &&
                this.domainCounts[tab.domain] <= maxTabCount;

            const matchesTimeframe = (!openedAfter || tab.timestamp > openedAfter) &&
                (!openedBefore || tab.timestamp < openedBefore);

            return matchesTitle && matchesUrl && matchesDomain &&
                matchesTabCount && matchesTimeframe;
        });
    }

    findDuplicateUrls() {
        // Group tabs by URL
        const urlGroups = this.tabs.reduce((acc, tab) => {
            if (!acc[tab.url]) {
                acc[tab.url] = [];
            }
            acc[tab.url].push(tab);
            return acc;
        }, {});

        // Filter to only duplicates
        const duplicates = Object.entries(urlGroups)
            .filter(([_, tabs]) => tabs.length > 1)
            .map(([url, tabs]) => ({
                url,
                count: tabs.length,
                tabs: tabs
            }));

        return duplicates;
    }

    createDuplicateSection() {
        const duplicates = this.findDuplicateUrls();

        // Remove existing duplicate section if it exists
        const existingDuplicateSection = document.getElementById('duplicateSection');
        if (existingDuplicateSection) {
            existingDuplicateSection.remove();
        }

        // If no duplicates, don't create anything
        if (duplicates.length === 0) return;

        // Create duplicate section
        const duplicateSection = document.createElement('div');
        duplicateSection.id = 'duplicateSection';
        duplicateSection.className = 'bg-yellow-100 p-4 mb-4 rounded';

        const duplicateHeader = document.createElement('h3');
        duplicateHeader.className = 'text-lg font-bold mb-2 text-yellow-800';
        duplicateHeader.textContent = `Duplicate URLs Found (${duplicates.length})`;
        duplicateSection.appendChild(duplicateHeader);

        // Create list of duplicates
        duplicates.forEach(duplicate => {
            const duplicateItem = document.createElement('div');
            duplicateItem.className = 'mb-2 p-2 bg-yellow-200 rounded flex justify-between items-center';

            const duplicateInfo = document.createElement('span');
            duplicateInfo.innerHTML = `
            <strong>${duplicate.count} tabs</strong> 
            <a href="${duplicate.url}" target="_blank" class="text-blue-600 ml-2">${duplicate.url}</a>
          `;

            const actionButtons = document.createElement('div');

            // Button to show duplicate tabs
            const showTabsButton = document.createElement('button');
            showTabsButton.textContent = 'Show Tabs';
            showTabsButton.className = 'mr-2 bg-blue-500 text-white p-1 rounded';
            showTabsButton.addEventListener('click', () => {
                // Highlight or show these specific tabs
                this.highlightDuplicateTabs(duplicate.tabs);
            });

            // Button to remove duplicates
            const removeDuplicatesButton = document.createElement('button');
            removeDuplicatesButton.textContent = 'Remove Duplicates';
            removeDuplicatesButton.className = 'bg-red-500 text-white p-1 rounded';
            removeDuplicatesButton.addEventListener('click', () => {
                this.removeDuplicateTabs(duplicate.tabs);
            });

            actionButtons.appendChild(showTabsButton);
            actionButtons.appendChild(removeDuplicatesButton);

            duplicateItem.appendChild(duplicateInfo);
            duplicateItem.appendChild(actionButtons);

            duplicateSection.appendChild(duplicateItem);
        });

        // Insert duplicate section at the top of the popup
        const tabsListContainer = document.getElementById('tabsList');
        tabsListContainer.parentNode.insertBefore(duplicateSection, tabsListContainer);
    }

    highlightDuplicateTabs(duplicateTabs) {
        // Deselect all tabs first
        this.tabs.forEach(tab => tab.selected = false);

        // Select and highlight duplicate tabs
        duplicateTabs.forEach(duplicateTab => {
            const matchingTab = this.tabs.find(tab => tab.id === duplicateTab.id);
            if (matchingTab) {
                matchingTab.selected = true;
            }
        });

        // Re-render tabs to show selection
        this.renderTabs();
    }

    removeDuplicateTabs(duplicateTabs) {
        // Keep the first tab, remove others
        const tabToKeep = duplicateTabs[0];
        const tabIdsToRemove = duplicateTabs
            .slice(1)  // Exclude the first tab
            .map(tab => tab.id);

        // Remove tabs from Chrome
        tabIdsToRemove.forEach(tabId => chrome.tabs.remove(tabId));

        // Reload tabs to refresh the view
        this.loadTabs();
    }

    // TAB GROUPING FUNCTIONALITY

    createTabGroupingSection() {
        // Remove any existing tab grouping section
        const existingSection = document.getElementById('tabGroupingSection');
        if (existingSection) {
            existingSection.remove();
        }

        // Get domains with multiple tabs
        const domainsWithMultipleTabs = Object.entries(this.domainCounts)
            .filter(([_, count]) => count > 1)
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count);  // Sort by count descending

        // If no domains with multiple tabs, don't create the section
        if (domainsWithMultipleTabs.length === 0) return;

        // Create the section container
        const groupingSection = document.createElement('div');
        groupingSection.id = 'tabGroupingSection';
        groupingSection.className = 'bg-blue-100 p-4 mb-4 rounded';

        // Add header
        const header = document.createElement('h3');
        header.className = 'text-lg font-bold mb-2 text-blue-800';
        header.textContent = 'Tab Grouping';
        groupingSection.appendChild(header);

        // Add description
        const description = document.createElement('p');
        description.className = 'mb-2 text-blue-700';
        description.textContent = 'Group tabs by domain for better organization.';
        groupingSection.appendChild(description);

        // Add "Group All Domains" button
        const groupAllButton = document.createElement('button');
        groupAllButton.textContent = 'Group All By Domain';
        groupAllButton.className = 'bg-blue-500 text-white p-2 rounded mb-4 w-full';
        groupAllButton.addEventListener('click', () => {
            this.groupAllTabsByDomain();
        });
        groupingSection.appendChild(groupAllButton);

        // Create list of domains that can be grouped
        const domainList = document.createElement('div');
        domainList.className = 'max-h-48 overflow-y-auto';

        domainsWithMultipleTabs.forEach(({ domain, count }) => {
            const domainItem = document.createElement('div');
            domainItem.className = 'mb-2 p-2 bg-blue-200 rounded flex justify-between items-center';

            const domainInfo = document.createElement('span');
            domainInfo.innerHTML = `<strong>${domain}</strong> <span class="text-blue-700">(${count} tabs)</span>`;

            const groupButton = document.createElement('button');
            groupButton.textContent = 'Group Tabs';
            groupButton.className = 'bg-blue-500 text-white p-1 rounded';
            groupButton.addEventListener('click', () => {
                this.groupTabsByDomain(domain);
            });

            domainItem.appendChild(domainInfo);
            domainItem.appendChild(groupButton);
            domainList.appendChild(domainItem);
        });

        groupingSection.appendChild(domainList);

        // Insert the section at the top of the popup
        const tabsListContainer = document.getElementById('tabsList');
        tabsListContainer.parentNode.insertBefore(groupingSection, tabsListContainer);
    }

    async groupTabsByDomain(domain) {
        try {
            // Find all tabs with the specified domain
            const tabsToGroup = this.tabs.filter(tab => tab.domain === domain);

            if (tabsToGroup.length < 2) {
                console.log(`Not enough tabs (${tabsToGroup.length}) for domain ${domain} to create a group`);
                return;
            }

            const tabIds = tabsToGroup.map(tab => tab.id);

            // Check if a group for this domain already exists
            const existingGroups = await new Promise(resolve =>
                chrome.tabGroups.query({ title: domain }, resolve)
            );

            let groupId;

            if (existingGroups && existingGroups.length > 0) {
                // Update existing group
                groupId = existingGroups[0].id;
                await new Promise(resolve =>
                    chrome.tabs.group({
                        groupId: groupId,
                        tabIds: tabIds
                    }, resolve)
                );
            } else {
                // Create new group
                groupId = await new Promise(resolve =>
                    chrome.tabs.group({ tabIds: tabIds }, resolve)
                );

                // Assign domain name and a color
                await new Promise(resolve =>
                    chrome.tabGroups.update(groupId, {
                        title: domain,
                        color: this.getColorForDomain(domain)
                    }, resolve)
                );
            }

            console.log(`Successfully grouped ${tabIds.length} tabs for domain ${domain}`);

            // Refresh the tab list
            this.loadTabs();

        } catch (error) {
            console.error(`Error grouping tabs for domain ${domain}:`, error);
        }
    }

    // async groupAllTabsByDomain() {
    //     try {
    //         // Get all domains with multiple tabs
    //         const domainsWithMultipleTabs = Object.entries(this.domainCounts)
    //             .filter(([_, count]) => count > 1)
    //             .map(([domain]) => domain);

    //         // Group tabs for each domain
    //         for (const domain of domainsWithMultipleTabs) {
    //             await this.groupTabsByDomain(domain);
    //         }

    //         console.log(`Successfully grouped tabs for ${domainsWithMultipleTabs.length} domains`);

    //     } catch (error) {
    //         console.error('Error grouping all tabs by domain:', error);
    //     }
    // }

    async groupTabsByDomain(domain) {
        try {
            // Find all tabs with the specified domain
            const tabsToGroup = this.tabs.filter(tab => tab.domain === domain);

            if (tabsToGroup.length < 2) {
                console.log(`Not enough tabs (${tabsToGroup.length}) for domain ${domain} to create a group`);
                return;
            }

            const tabIds = tabsToGroup.map(tab => tab.id);

            // Create new group directly without checking for existing groups
            // This avoids the chrome.tabGroups.query that's causing the error
            const groupId = await new Promise(resolve =>
                chrome.tabs.group({ tabIds: tabIds }, resolve)
            );

            // Set the title and color for the group
            if (chrome.tabGroups && chrome.tabGroups.update) {
                // Only attempt to update if the tabGroups API is available
                chrome.tabGroups.update(groupId, {
                    title: domain,
                    color: this.getColorForDomain(domain)
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log("Error updating group:", chrome.runtime.lastError);
                    }
                });
            }

            console.log(`Successfully grouped ${tabIds.length} tabs for domain ${domain}`);

            // Refresh the tab list
            this.loadTabs();

        } catch (error) {
            console.error(`Error grouping tabs for domain ${domain}:`, error);
        }
    }

    getColorForDomain(domain) {
        // Chrome offers these colors: "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"
        const colors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan"];

        // Create a simple hash from the domain string
        let hash = 0;
        for (let i = 0; i < domain.length; i++) {
            hash = ((hash << 5) - hash) + domain.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }

        // Get a deterministic color from the hash
        const colorIndex = Math.abs(hash) % colors.length;
        return colors[colorIndex];
    }
}

// Initialize Tab Manager
document.addEventListener('DOMContentLoaded', () => {
    const tabManager = new TabManager();
    tabManager.loadTabs();
});