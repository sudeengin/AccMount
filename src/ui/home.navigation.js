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
        cariler: buttons.cariler || null,
        notebook: buttons.notebook || null
    };

    const viewRefs = {
        dashboard: views.dashboard || null,
        main: views.main || null,
        detail: views.detail || null,
        transactionDetail: views.transactionDetail || null,
        notebook: views.notebook || null
    };

    const { onDashboard, onNotebook } = callbacks || {};

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

    return {
        setActiveNav,
        showDashboard,
        showCarilerView,
        showDetailView,
        showTransactionDetail,
        showCompanyNotebook
    };
}
