const setupView = document.getElementById("setup-view") as HTMLDivElement;
const configuredView = document.getElementById("configured-view") as HTMLDivElement;
const input = document.getElementById("key-input") as HTMLInputElement;
const btn = document.getElementById("save") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;
const changeKeyBtn = document.getElementById("change-key-btn") as HTMLButtonElement;

function checkKey() {
    chrome.storage.sync.get(["openRouterKey", "geminiKey"], (data) => {
        const apiKey = (data.openRouterKey || data.geminiKey) as string;
        if (apiKey) {
            setupView.classList.add("hidden");
            configuredView.classList.remove("hidden");
            input.value = apiKey;
        } else {
            configuredView.classList.add("hidden");
            setupView.classList.remove("hidden");
        }
    });
}

// Initial check on popup open
checkKey();

btn.addEventListener("click", () => {
    const key = input.value.trim();
    if (!key) return;
    
    // Save under the new openRouterKey name
    chrome.storage.sync.set({ openRouterKey: key }, () => {
        status.textContent = "Saved ✓";
        setTimeout(() => {
            status.textContent = "";
            checkKey();
        }, 1000);
    });
});

changeKeyBtn.addEventListener("click", () => {
    configuredView.classList.add("hidden");
    setupView.classList.remove("hidden");
});

document.getElementById("popup-suggest-btn")?.addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_MOVE_FROM_POPUP" });
        }
    });
});
document.getElementById("popup-analyze-btn")?.addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "ANALYZE_GAME_FROM_POPUP" });
        }
    });
});
