function toggleNavButton(button, isActive) {
    if (!button) return;
    button.classList.toggle("bg-indigo-600", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("bg-gray-800", !isActive);
    button.classList.toggle("text-gray-200", !isActive);
}

function hideView(element) {
    if (!element) return;
    element.classList.add("hidden");
}

function showView(element) {
    if (!element) return;
    element.classList.remove("hidden");
}

export default function createHomeNavigation({
    buttons = {},
    views = {},
    callbacks = {}
} = {}) {
    const navButtons = {
        dashboard: buttons.dashboard || null,
        financialSummary: buttons.financialSummary || null,
        cariler: buttons.cariler || null,
        notebook: buttons.notebook || null,
        migration: buttons.migration || null
    };

    const viewRefs = {
        dashboard: views.dashboard || null,
        financialSummary: views.financialSummary || null,
        main: views.main || null,
        detail: views.detail || null,
        transactionDetail: views.transactionDetail || null,
        notebook: views.notebook || null,
        migration: views.migration || null
    };

    const { onDashboard, onFinancialSummary, onNotebook, onMigration } = callbacks || {};

    function setActiveNav(key) {
        Object.entries(navButtons).forEach(([navKey, button]) => {
            toggleNavButton(button, navKey === key);
        });
    }

    function hideAllViews() {
        Object.values(viewRefs).forEach(hideView);
    }

    function showDashboard() {
        setActiveNav("dashboard");
        hideAllViews();
        showView(viewRefs.dashboard);
        if (typeof onDashboard === "function") {
            onDashboard();
        }
    }

    function showFinancialSummary() {
        setActiveNav("financialSummary");
        hideAllViews();
        showView(viewRefs.financialSummary);
        if (typeof onFinancialSummary === "function") {
            onFinancialSummary();
        }
    }

    function showCarilerView() {
        setActiveNav("cariler");
        hideAllViews();
        showView(viewRefs.main);
    }

    function showDetailView({ skipViewUpdate = false } = {}) {
        setActiveNav("cariler");
        if (skipViewUpdate) return;
        hideAllViews();
        showView(viewRefs.detail);
    }

    function showTransactionDetail({ skipViewUpdate = false } = {}) {
        setActiveNav("cariler");
        if (skipViewUpdate) return;
        hideAllViews();
        showView(viewRefs.transactionDetail);
    }

    function showCompanyNotebook() {
        setActiveNav("notebook");
        hideAllViews();
        showView(viewRefs.notebook);
        if (typeof onNotebook === "function") {
            onNotebook();
        }
    }

    function showMigration() {
        setActiveNav("migration");
        hideAllViews();
        showView(viewRefs.migration);
        if (typeof onMigration === "function") {
            onMigration();
        }
    }

    return {
        setActiveNav,
        showDashboard,
        showFinancialSummary,
        showCarilerView,
        showDetailView,
        showTransactionDetail,
        showCompanyNotebook,
        showMigration
    };
}
