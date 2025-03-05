document.getElementById('downloadTabs').addEventListener('click', () => {
    // Query all tabs across all windows
    chrome.tabs.query({}, (tabs) => {
        // Create markdown table
        let content = "| Title | Link |\n";
        content += "|-------|------|\n";

        // Escape special markdown characters in titles to prevent table formatting issues
        const escapeMarkdown = (text) => {
            return text
                .replace(/\|/g, '\\|')
                .replace(/\n/g, ' ')
                .trim();
        };

        // Add each tab to the table
        tabs.forEach(tab => {
            const escapedTitle = escapeMarkdown(tab.title);
            content += `| ${escapedTitle} | ${tab.url} |\n`;
        });

        // Create a Blob with the content
        const blob = new Blob([content], { type: 'text/markdown' });

        // Create a download link
        const url = URL.createObjectURL(blob);

        // Trigger download
        chrome.downloads.download({
            url: url,
            filename: 'open_tabs.md',
            saveAs: true  // This will prompt the user to choose save location
        }, () => {
            // Revoke the blob URL after download is triggered
            URL.revokeObjectURL(url);
        });
    });
});