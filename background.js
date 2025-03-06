// Background service worker for periodic backup, sync, and analytics

const getDomain = (url) => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (e) {
        return 'Unknown';
    }
};

// Backup and Sync Management
chrome.runtime.onInstalled.addListener(() => {
    // Set up periodic backup and sync
    chrome.alarms.create('tabBackup', { periodInMinutes: 60 });
    chrome.alarms.create('statsRefresh', { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tabBackup') {
        backupTabs();
        syncWithCloud();
    }
    if (alarm.name === 'statsRefresh') {
        generateDomainStats();
    }
});

// Cloud Sync (simulated)
async function syncWithCloud() {
    try {
        const localData = await new Promise(resolve =>
            chrome.storage.local.get(['tabBackups', 'domainStats'], resolve)
        );

        // Simulated cloud sync - in real implementation, use your API
        const cloud = await chrome.storage.sync.get('backupData');
        const mergedBackups = mergeBackups(
            cloud.backupData || [],
            localData.tabBackups || []
        );

        await Promise.all([
            chrome.storage.sync.set({ backupData: mergedBackups }),
            chrome.storage.local.set({ tabBackups: mergedBackups })
        ]);

        console.log('Cloud sync completed');
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

function mergeBackups(cloud, local) {
    const allBackups = [...cloud, ...local];
    const unique = new Map();
    allBackups.forEach(backup =>
        unique.set(backup.timestamp, backup)
    );
    return Array.from(unique.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
}

// Backup Implementation
function backupTabs() {
    chrome.tabs.query({}, (tabs) => {
        const tabData = tabs.map(tab => ({
            title: tab.title,
            url: tab.url,
            domain: getDomain(tab.url),
            timestamp: Date.now()
        }));

        chrome.storage.local.get(['tabBackups'], (result) => {
            const backups = result.tabBackups || [];
            backups.push({
                timestamp: Date.now(),
                tabs: tabData,
                stats: generateQuickStats(tabData)
            });

            chrome.storage.local.set({ tabBackups: backups.slice(-10) });
        });
    });
}

function generateQuickStats(tabs) {
    const domains = tabs.reduce((acc, tab) => {
        acc[tab.domain] = (acc[tab.domain] || 0) + 1;
        return acc;
    }, {});

    return {
        totalTabs: tabs.length,
        uniqueDomains: Object.keys(domains).length,
        mostActiveDomain: Object.entries(domains)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'
    };
}

// Data Analytics
function generateDomainStats() {
    chrome.tabs.query({}, (tabs) => {
        const domainData = tabs.reduce((acc, tab) => {
            const domain = getDomain(tab.url);
            if (!acc[domain]) {
                acc[domain] = {
                    count: 0,
                    titles: new Set(),
                    windows: new Set()
                };
            }
            acc[domain].count++;
            acc[domain].titles.add(tab.title);
            acc[domain].windows.add(tab.windowId);
            return acc;
        }, {});

        const stats = {
            generatedAt: Date.now(),
            domains: Object.entries(domainData).map(([name, data]) => ({
                name,
                tabCount: data.count,
                uniqueTitles: data.titles.size,
                windowCount: data.windows.size,
                popularityScore: data.count * data.windows.size
            })).sort((a, b) => b.popularityScore - a.popularityScore)
        };

        chrome.storage.local.set({ domainStats: stats });
    });
}

// Restore Functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'restoreBackup') {
        restoreBackup(request.timestamp);
    }
    return true;
});

async function restoreBackup(timestamp) {
    const { tabBackups } = await new Promise(resolve =>
        chrome.storage.local.get('tabBackups', resolve)
    );

    const backup = tabBackups.find(b => b.timestamp === timestamp);
    if (!backup) return;

    // Close existing tabs
    const currentTabs = await new Promise(resolve =>
        chrome.tabs.query({}, resolve)
    );
    currentTabs.forEach(tab => chrome.tabs.remove(tab.id));

    // Restore backup tabs
    backup.tabs.forEach(tab =>
        chrome.tabs.create({ url: tab.url, active: false })
    );
}

// Usage Statistics
chrome.tabs.onCreated.addListener(updateActivityStats);
chrome.tabs.onRemoved.addListener(updateActivityStats);
chrome.tabs.onUpdated.addListener(updateActivityStats);

function updateActivityStats() {
    chrome.storage.local.get(['usageStats'], (result) => {
        const stats = result.usageStats || {
            tabCreations: 0,
            tabClosures: 0,
            tabUpdates: 0,
            lastUpdated: Date.now()
        };

        stats.lastUpdated = Date.now();
        chrome.storage.local.set({ usageStats: stats });
    });
}