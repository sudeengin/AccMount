import homeView from "./ui/views/home.view.js";

function getHomeConfig() {
    return window.__APP_HOME_CONFIG__ || {};
}

function getNotebookRoot() {
    return window.__APP_NOTEBOOK_ROOT__ || null;
}

const homeConfig = getHomeConfig();
const homeRoot = homeConfig.root;
const homeDeps = homeConfig.deps || {};
const notebookRoot = getNotebookRoot();

const navDashboardBtn = document.getElementById("navDashboardBtn");
const navFinancialSummaryBtn = document.getElementById("navFinancialSummaryBtn");
const navCarilerBtn = document.getElementById("navCarilerBtn");
const navNotebookBtn = document.getElementById("navNotebookBtn");
const navMigrationBtn = document.getElementById("navMigrationBtn");

function isHomeViewEnabled() {
    const config = getHomeConfig();
    return config.flags?.useHomeView !== false;
}

function hideNotebook() {
    if (notebookRoot) {
        notebookRoot.classList.add("hidden");
    }
}

function showNotebook() {
    if (isHomeViewEnabled()) {
        if (!homeView.isMounted()) {
            homeView.mount(homeRoot, homeDeps);
        }
        if (notebookRoot) {
            notebookRoot.classList.remove("hidden");
        }
        if (typeof homeDeps?.showCompanyNotebook === "function") {
            homeDeps.showCompanyNotebook();
        }
        return;
    }
    if (homeView.isMounted()) {
        homeView.unmount();
    }
    if (notebookRoot) {
        notebookRoot.classList.remove("hidden");
    }
    if (typeof homeDeps?.showCompanyNotebook === "function") {
        homeDeps.showCompanyNotebook();
    }
}

function ensureHomeMounted() {
    hideNotebook();
    if (!isHomeViewEnabled()) {
        return;
    }
    if (!homeView.isMounted()) {
        homeView.mount(homeRoot, homeDeps);
    }
}

function showHomeDashboard() {
    ensureHomeMounted();
    if (typeof homeDeps?.showDashboard === "function") {
        homeDeps.showDashboard();
    }
}

function showHomeCariler() {
    ensureHomeMounted();
    if (typeof homeDeps?.showCarilerView === "function") {
        homeDeps.showCarilerView();
    }
}

function showFinancialSummary() {
    ensureHomeMounted();
    if (typeof homeDeps?.showFinancialSummary === "function") {
        homeDeps.showFinancialSummary();
    }
}

function showMigration() {
    ensureHomeMounted();
    if (typeof homeDeps?.showMigration === "function") {
        homeDeps.showMigration();
    }
}

if (navDashboardBtn) {
    navDashboardBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showHomeDashboard();
    });
}

if (navFinancialSummaryBtn) {
    navFinancialSummaryBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showFinancialSummary();
    });
}

if (navCarilerBtn) {
    navCarilerBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showHomeCariler();
    });
}

if (navNotebookBtn) {
    navNotebookBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showNotebook();
    });
}

if (navMigrationBtn) {
    navMigrationBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showMigration();
    });
}

// Initial mount
showHomeDashboard();
