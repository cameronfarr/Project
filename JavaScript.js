const STORAGE_KEY = "spmTrackerStateV1";

const CATEGORY_LABELS = {
    analysis: "Requirements Analysis",
    design: "Designing",
    coding: "Coding",
    testing: "Testing",
    management: "Project Management"
};

const RISK_STATUSES = ["Open", "Monitoring", "Mitigated", "Closed"];
const REQUIREMENT_TYPES = ["Functional", "Non-Functional"];
const REQUIREMENT_STATUSES = ["Not Started", "In Progress", "Complete"];

let state = createDefaultState();
let messageTimer = null;

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    state = loadState();
    bindEvents();
    syncProjectForm();
    updatePeriodInput();
    renderAll();
}

function createDefaultState() {
    return {
        projectInfo: {
            description: "",
            manager: ""
        },
        teamMembers: [],
        risks: [],
        requirements: [],
        effortLogs: []
    };
}

function loadState() {
    const defaults = createDefaultState();
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (!savedState) {
        return defaults;
    }

    try {
        const parsed = JSON.parse(savedState);

        return {
            ...defaults,
            ...parsed,
            projectInfo: {
                ...defaults.projectInfo,
                ...(parsed.projectInfo || {})
            },
            teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
            effortLogs: Array.isArray(parsed.effortLogs) ? parsed.effortLogs : []
        };
    } catch (error) {
        console.warn("Stored tracker data could not be loaded.", error);
        return defaults;
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
    byId("projectForm").addEventListener("submit", handleProjectSubmit);
    byId("teamForm").addEventListener("submit", handleTeamSubmit);
    byId("riskForm").addEventListener("submit", handleRiskSubmit);
    byId("requirementForm").addEventListener("submit", handleRequirementSubmit);
    byId("effortForm").addEventListener("submit", handleEffortSubmit);
    byId("periodType").addEventListener("change", updatePeriodInput);
    byId("clearDataButton").addEventListener("click", handleResetData);

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("change", handleDocumentChange);
}

function handleProjectSubmit(event) {
    event.preventDefault();

    const description = byId("projectDescription").value.trim();
    const manager = byId("projectManager").value.trim();

    if (!description && !manager) {
        announce("Enter a project description or project manager before saving.", "error");
        return;
    }

    state.projectInfo.description = description;
    state.projectInfo.manager = manager;
    saveAndRender("Project information saved.");
}

function handleTeamSubmit(event) {
    event.preventDefault();

    const nameInput = byId("teamMemberName");
    const name = nameInput.value.trim();

    if (!name) {
        announce("Enter a team member name.", "error");
        return;
    }

    if (hasDuplicateName(state.teamMembers, name)) {
        announce("That team member is already listed.", "error");
        return;
    }

    state.teamMembers.push({ id: createId(), name });
    nameInput.value = "";
    saveAndRender("Team member added.");
}

function handleRiskSubmit(event) {
    event.preventDefault();

    const titleInput = byId("riskTitle");
    const title = titleInput.value.trim();
    const status = byId("riskStatus").value;

    if (!title) {
        announce("Enter a risk description.", "error");
        return;
    }

    state.risks.push({ id: createId(), title, status });
    titleInput.value = "";
    byId("riskStatus").value = "Open";
    saveAndRender("Risk added.");
}

function handleRequirementSubmit(event) {
    event.preventDefault();

    const nameInput = byId("requirementName");
    const name = nameInput.value.trim();
    const type = byId("requirementType").value;
    const status = byId("requirementStatus").value;

    if (!name) {
        announce("Enter a requirement name.", "error");
        return;
    }

    state.requirements.push({ id: createId(), name, type, status });
    nameInput.value = "";
    byId("requirementType").value = "Functional";
    byId("requirementStatus").value = "Not Started";
    saveAndRender("Requirement added.");
}

function handleEffortSubmit(event) {
    event.preventDefault();

    const requirementId = byId("effortRequirement").value;
    const memberId = byId("effortMember").value;
    const category = byId("effortCategory").value;
    const periodType = byId("periodType").value;
    const periodValue = byId("periodValue").value.trim();
    const hours = Number.parseFloat(byId("effortHours").value);

    if (!requirementId || !memberId) {
        announce("Add at least one requirement and one team member before logging effort.", "error");
        return;
    }

    if (!isValidPeriod(periodType, periodValue)) {
        announce("Enter a valid day or week before logging effort.", "error");
        return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
        announce("Enter a valid number of hours greater than zero.", "error");
        return;
    }

    state.effortLogs.push({
        id: createId(),
        requirementId,
        memberId,
        category,
        periodType,
        periodValue,
        hours: roundHours(hours)
    });

    byId("effortHours").value = "";
    saveAndRender("Effort logged.");
}

function handleDocumentClick(event) {
    const button = event.target.closest("[data-action]");

    if (!button) {
        return;
    }

    const { action, id } = button.dataset;

    if (action === "remove-team") {
        removeTeamMember(id);
    }

    if (action === "remove-risk") {
        removeRisk(id);
    }

    if (action === "remove-requirement") {
        removeRequirement(id);
    }

    if (action === "remove-effort") {
        removeEffortLog(id);
    }
}

function handleDocumentChange(event) {
    const field = event.target.dataset.field;
    const id = event.target.dataset.id;

    if (!field || !id) {
        return;
    }

    if (field.startsWith("risk-")) {
        updateRisk(id, field, event.target.value);
    }

    if (field.startsWith("requirement-")) {
        updateRequirement(id, field, event.target.value);
    }
}

function removeTeamMember(id) {
    const member = state.teamMembers.find((item) => item.id === id);

    if (!member) {
        return;
    }

    const relatedLogs = state.effortLogs.some((log) => log.memberId === id);
    const confirmed = !relatedLogs || confirm("Removing this team member will also remove their effort logs.");

    if (!confirmed) {
        return;
    }

    state.teamMembers = state.teamMembers.filter((item) => item.id !== id);
    state.effortLogs = state.effortLogs.filter((log) => log.memberId !== id);
    saveAndRender("Team member removed.");
}

function removeRisk(id) {
    state.risks = state.risks.filter((risk) => risk.id !== id);
    saveAndRender("Risk removed.");
}

function removeRequirement(id) {
    const requirement = state.requirements.find((item) => item.id === id);

    if (!requirement) {
        return;
    }

    const relatedLogs = state.effortLogs.some((log) => log.requirementId === id);
    const confirmed = !relatedLogs || confirm("Deleting this requirement will also remove its effort logs.");

    if (!confirmed) {
        return;
    }

    state.requirements = state.requirements.filter((item) => item.id !== id);
    state.effortLogs = state.effortLogs.filter((log) => log.requirementId !== id);
    saveAndRender("Requirement deleted.");
}

function removeEffortLog(id) {
    state.effortLogs = state.effortLogs.filter((log) => log.id !== id);
    saveAndRender("Effort log removed.");
}

function updateRisk(id, field, value) {
    const risk = state.risks.find((item) => item.id === id);

    if (!risk) {
        return;
    }

    if (field === "risk-title") {
        const title = value.trim();

        if (!title) {
            announce("Risk description cannot be blank.", "error");
            renderAll();
            return;
        }

        risk.title = title;
    }

    if (field === "risk-status") {
        risk.status = value;
    }

    saveAndRender("Risk updated.");
}

function updateRequirement(id, field, value) {
    const requirement = state.requirements.find((item) => item.id === id);

    if (!requirement) {
        return;
    }

    if (field === "requirement-name") {
        const name = value.trim();

        if (!name) {
            announce("Requirement name cannot be blank.", "error");
            renderAll();
            return;
        }

        requirement.name = name;
    }

    if (field === "requirement-type") {
        requirement.type = value;
    }

    if (field === "requirement-status") {
        requirement.status = value;
    }

    saveAndRender("Requirement updated.");
}

function handleResetData() {
    const confirmed = confirm("Reset all project data in this browser?");

    if (!confirmed) {
        return;
    }

    state = createDefaultState();
    localStorage.removeItem(STORAGE_KEY);
    syncProjectForm();
    updatePeriodInput();
    renderAll();
    announce("Project data reset.");
}

function saveAndRender(message) {
    saveState();
    renderAll();
    announce(message);
}

function syncProjectForm() {
    byId("projectDescription").value = state.projectInfo.description || "";
    byId("projectManager").value = state.projectInfo.manager || "";
}

function renderAll() {
    renderMetrics();
    renderTeamMembers();
    renderRisks();
    renderRequirements();
    renderEffortDropdowns();
    renderEffortLogs();
    renderReports();
    renderAnalytics();
}

function renderMetrics() {
    byId("metricRequirements").textContent = state.requirements.length;
    byId("metricHours").textContent = formatHours(sumHours(state.effortLogs));
    byId("metricMembers").textContent = state.teamMembers.length;
    byId("metricRisks").textContent = state.risks.filter((risk) => risk.status !== "Closed").length;
}

function renderTeamMembers() {
    const list = byId("teamList");
    list.innerHTML = "";

    if (!state.teamMembers.length) {
        list.appendChild(createEmptyBlock("No team members added yet."));
        return;
    }

    state.teamMembers.forEach((member) => {
        const row = document.createElement("div");
        row.className = "list-row";

        const name = document.createElement("span");
        name.textContent = member.name;

        const removeButton = createActionButton("Remove", "remove-team", member.id);
        row.append(name, removeButton);
        list.appendChild(row);
    });
}

function renderRisks() {
    const table = byId("riskTable");
    table.innerHTML = "";

    if (!state.risks.length) {
        appendEmptyRow(table, 3, "No risks added yet.");
        return;
    }

    state.risks.forEach((risk) => {
        const row = document.createElement("tr");
        const titleInput = createTextInput(risk.title, "risk-title", risk.id);
        const statusSelect = createSelect(risk.status, RISK_STATUSES, "risk-status", risk.id);

        addCell(row, titleInput);
        addCell(row, statusSelect);
        addCell(row, createActionButton("Delete", "remove-risk", risk.id), "action-column");
        table.appendChild(row);
    });
}

function renderRequirements() {
    const table = byId("requirementsTable");
    const totals = getRequirementTotals();
    table.innerHTML = "";

    if (!state.requirements.length) {
        appendEmptyRow(table, 5, "No requirements added yet.");
        return;
    }

    state.requirements.forEach((requirement) => {
        const row = document.createElement("tr");
        const nameInput = createTextInput(requirement.name, "requirement-name", requirement.id);
        const typeSelect = createSelect(requirement.type, REQUIREMENT_TYPES, "requirement-type", requirement.id);
        const statusSelect = createSelect(requirement.status, REQUIREMENT_STATUSES, "requirement-status", requirement.id);

        addCell(row, nameInput);
        addCell(row, typeSelect);
        addCell(row, statusSelect);
        addCell(row, formatHours(totals[requirement.id] || 0), "number-column");
        addCell(row, createActionButton("Delete", "remove-requirement", requirement.id), "action-column");
        table.appendChild(row);
    });
}

function renderEffortDropdowns() {
    renderEntityOptions(byId("effortRequirement"), state.requirements, "No requirements available");
    renderEntityOptions(byId("effortMember"), state.teamMembers, "No team members available");

    byId("effortRequirement").disabled = state.requirements.length === 0;
    byId("effortMember").disabled = state.teamMembers.length === 0;
}

function renderEffortLogs() {
    const table = byId("effortTable");
    table.innerHTML = "";

    if (!state.effortLogs.length) {
        appendEmptyRow(table, 6, "No effort logged yet.");
        return;
    }

    state.effortLogs.slice().reverse().forEach((log) => {
        const row = document.createElement("tr");

        addCell(row, formatPeriod(log));
        addCell(row, getRequirementName(log.requirementId));
        addCell(row, getMemberName(log.memberId));
        addCell(row, CATEGORY_LABELS[log.category] || log.category);
        addCell(row, formatHours(log.hours), "number-column");
        addCell(row, createActionButton("Delete", "remove-effort", log.id), "action-column");
        table.appendChild(row);
    });
}

function renderReports() {
    renderCategoryReport();
    renderRequirementReport();
    renderPeriodReport("daily", byId("dailyReport"));
    renderPeriodReport("weekly", byId("weeklyReport"));
}

function renderCategoryReport() {
    const table = byId("categoryReport");
    const totals = getCategoryTotals();
    table.innerHTML = "";

    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
        const row = document.createElement("tr");
        addCell(row, label);
        addCell(row, formatHours(totals[key]), "number-column");
        table.appendChild(row);
    });
}

function renderRequirementReport() {
    const table = byId("requirementReport");
    const totals = getRequirementTotals();
    table.innerHTML = "";

    if (!state.requirements.length) {
        appendEmptyRow(table, 2, "No requirements to report yet.");
        return;
    }

    state.requirements.forEach((requirement) => {
        const row = document.createElement("tr");
        addCell(row, requirement.name);
        addCell(row, formatHours(totals[requirement.id] || 0), "number-column");
        table.appendChild(row);
    });
}

function renderPeriodReport(type, table) {
    const groups = getPeriodGroups(type);
    table.innerHTML = "";

    if (!groups.length) {
        appendEmptyRow(table, 3, type === "daily" ? "No daily entries yet." : "No weekly entries yet.");
        return;
    }

    groups.forEach((group) => {
        const row = document.createElement("tr");
        addCell(row, group.period);
        addCell(row, group.entries, "number-column");
        addCell(row, formatHours(group.hours), "number-column");
        table.appendChild(row);
    });
}

function renderAnalytics() {
    const requirementTotals = getRequirementTotals();
    const categoryTotals = getCategoryTotals();
    const memberTotals = getMemberTotals();
    const topRequirement = getTopRequirement(requirementTotals);
    const topCategory = getTopCategory(categoryTotals);
    const topMember = getTopMember(memberTotals);

    byId("topRequirement").textContent = topRequirement;
    byId("topCategory").textContent = topCategory;
    byId("topMember").textContent = topMember;
    byId("completionRate").textContent = getCompletionRate();

    renderMemberAnalytics(memberTotals);
    renderProgressAnalytics(requirementTotals);
}

function renderMemberAnalytics(memberTotals) {
    const table = byId("memberAnalytics");
    table.innerHTML = "";

    if (!state.teamMembers.length) {
        appendEmptyRow(table, 2, "No team members to analyze yet.");
        return;
    }

    state.teamMembers.forEach((member) => {
        const row = document.createElement("tr");
        addCell(row, member.name);
        addCell(row, formatHours(memberTotals[member.id] || 0), "number-column");
        table.appendChild(row);
    });
}

function renderProgressAnalytics(requirementTotals) {
    const table = byId("progressAnalytics");
    table.innerHTML = "";

    if (!state.requirements.length) {
        appendEmptyRow(table, 3, "No requirements to analyze yet.");
        return;
    }

    state.requirements.forEach((requirement) => {
        const row = document.createElement("tr");
        addCell(row, requirement.name);
        addCell(row, requirement.status);
        addCell(row, formatHours(requirementTotals[requirement.id] || 0), "number-column");
        table.appendChild(row);
    });
}

function getCategoryTotals() {
    const totals = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((key) => [key, 0]));

    state.effortLogs.forEach((log) => {
        if (Object.prototype.hasOwnProperty.call(totals, log.category)) {
            totals[log.category] += Number(log.hours) || 0;
        }
    });

    return totals;
}

function getRequirementTotals() {
    const totals = Object.fromEntries(state.requirements.map((requirement) => [requirement.id, 0]));

    state.effortLogs.forEach((log) => {
        if (Object.prototype.hasOwnProperty.call(totals, log.requirementId)) {
            totals[log.requirementId] += Number(log.hours) || 0;
        }
    });

    return totals;
}

function getMemberTotals() {
    const totals = Object.fromEntries(state.teamMembers.map((member) => [member.id, 0]));

    state.effortLogs.forEach((log) => {
        if (Object.prototype.hasOwnProperty.call(totals, log.memberId)) {
            totals[log.memberId] += Number(log.hours) || 0;
        }
    });

    return totals;
}

function getPeriodGroups(type) {
    const groups = new Map();

    state.effortLogs
        .filter((log) => log.periodType === type)
        .forEach((log) => {
            const current = groups.get(log.periodValue) || { period: log.periodValue, entries: 0, hours: 0 };
            current.entries += 1;
            current.hours += Number(log.hours) || 0;
            groups.set(log.periodValue, current);
        });

    return Array.from(groups.values()).sort((a, b) => b.period.localeCompare(a.period));
}

function getTopRequirement(requirementTotals) {
    const top = state.requirements
        .map((requirement) => ({ name: requirement.name, hours: requirementTotals[requirement.id] || 0 }))
        .sort((a, b) => b.hours - a.hours)[0];

    return top && top.hours > 0 ? `${top.name} (${formatHours(top.hours)} hrs)` : "None";
}

function getTopCategory(categoryTotals) {
    const top = Object.entries(categoryTotals)
        .map(([key, hours]) => ({ name: CATEGORY_LABELS[key], hours }))
        .sort((a, b) => b.hours - a.hours)[0];

    return top && top.hours > 0 ? `${top.name} (${formatHours(top.hours)} hrs)` : "None";
}

function getTopMember(memberTotals) {
    const top = state.teamMembers
        .map((member) => ({ name: member.name, hours: memberTotals[member.id] || 0 }))
        .sort((a, b) => b.hours - a.hours)[0];

    return top && top.hours > 0 ? `${top.name} (${formatHours(top.hours)} hrs)` : "None";
}

function getCompletionRate() {
    if (!state.requirements.length) {
        return "0%";
    }

    const complete = state.requirements.filter((requirement) => requirement.status === "Complete").length;
    return `${Math.round((complete / state.requirements.length) * 100)}%`;
}

function renderEntityOptions(select, items, emptyText) {
    select.innerHTML = "";

    if (!items.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = emptyText;
        select.appendChild(option);
        return;
    }

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

function createActionButton(label, action, id) {
    const button = document.createElement("button");
    button.className = action.includes("remove") ? "danger-button" : "secondary-button";
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
}

function createTextInput(value, field, id) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.dataset.field = field;
    input.dataset.id = id;
    return input;
}

function createSelect(value, options, field, id) {
    const select = document.createElement("select");
    select.dataset.field = field;
    select.dataset.id = id;

    options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    });

    select.value = value;
    return select;
}

function createEmptyBlock(text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text;
    return empty;
}

function appendEmptyRow(tableBody, colSpan, text) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colSpan;
    cell.className = "empty-cell";
    cell.textContent = text;
    row.appendChild(cell);
    tableBody.appendChild(row);
}

function addCell(row, content, className = "") {
    const cell = document.createElement("td");

    if (className) {
        cell.className = className;
    }

    if (content instanceof Node) {
        cell.appendChild(content);
    } else {
        cell.textContent = content;
    }

    row.appendChild(cell);
}

function updatePeriodInput() {
    const periodType = byId("periodType").value;
    const periodInput = byId("periodValue");
    const periodLabel = byId("periodLabel");

    if (periodType === "weekly") {
        periodInput.type = "text";
        periodInput.placeholder = "YYYY-W##";
        periodInput.pattern = "\\d{4}-W\\d{2}";
        periodLabel.textContent = "Week";

        if (!isValidPeriod("weekly", periodInput.value.trim())) {
            periodInput.value = getCurrentWeek();
        }

        return;
    }

    periodInput.type = "date";
    periodInput.removeAttribute("pattern");
    periodInput.placeholder = "";
    periodLabel.textContent = "Day";

    if (!isValidPeriod("daily", periodInput.value.trim())) {
        periodInput.value = getToday();
    }
}

function isValidPeriod(type, value) {
    if (type === "daily") {
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    if (type === "weekly") {
        const match = /^(\d{4})-W(\d{2})$/.exec(value);
        const week = match ? Number(match[2]) : 0;
        return Boolean(match) && week >= 1 && week <= 53;
    }

    return false;
}

function formatPeriod(log) {
    return log.periodType === "weekly" ? `Week ${log.periodValue}` : log.periodValue;
}

function getRequirementName(id) {
    return state.requirements.find((requirement) => requirement.id === id)?.name || "Removed requirement";
}

function getMemberName(id) {
    return state.teamMembers.find((member) => member.id === id)?.name || "Removed member";
}

function sumHours(logs) {
    return logs.reduce((total, log) => total + (Number(log.hours) || 0), 0);
}

function roundHours(value) {
    return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function formatHours(value) {
    const rounded = roundHours(value || 0);

    return rounded.toLocaleString(undefined, {
        minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
        maximumFractionDigits: 1
    });
}

function hasDuplicateName(items, name) {
    return items.some((item) => item.name.toLowerCase() === name.toLowerCase());
}

function announce(text, type = "success") {
    const message = byId("message");
    message.textContent = text;
    message.className = `message message-${type} is-visible`;

    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
        message.className = "message";
        message.textContent = "";
    }, 3500);
}

function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCurrentWeek() {
    const date = new Date();
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
    return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function byId(id) {
    return document.getElementById(id);
}
