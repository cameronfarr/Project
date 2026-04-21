let requirements = [];
let effortLogs = [];

function addRequirement() {
    const name = document.getElementById("reqName").value;
    const type = document.getElementById("reqType").value;

    if (!name) {
        alert("Enter requirement name");
        return;
    }

    const req = {
        id: Date.now(),
        name,
        type
    };

    requirements.push(req);
    refreshUI();
}

function displayRequirements() {
    const table = document.getElementById("reqTable");
    table.innerHTML = "";

    requirements.forEach(req => {
        table.innerHTML += `
            <tr>
                <td>${req.name}</td>
                <td>${req.type}</td>
            </tr>
        `;
    });
}

function logEffort() {
    const reqId = document.getElementById("effortReq").value;
    const hours = parseFloat(document.getElementById("hours").value);
    const category = document.getElementById("category").value;

    if (!hours || hours <= 0) {
        alert("Enter valid hours");
        return;
    }

    const log = {
        reqId,
        hours,
        category
    };

    effortLogs.push(log);
    updateReport();
}

function calculateTotals() {
    let totals = {
        analysis: 0,
        design: 0,
        coding: 0,
        testing: 0,
        management: 0
    };

    effortLogs.forEach(log => {
        totals[log.category] += log.hours;
    });

    return totals;
}

function updateReport() {
    const totals = calculateTotals();

    document.getElementById("analysisTotal").innerText = totals.analysis;
    document.getElementById("designTotal").innerText = totals.design;
    document.getElementById("codingTotal").innerText = totals.coding;
    document.getElementById("testingTotal").innerText = totals.testing;
    document.getElementById("managementTotal").innerText = totals.management;
}

function populateRequirementDropdown() {
    const dropdown = document.getElementById("effortReq");
    dropdown.innerHTML = "";

    requirements.forEach(req => {
        dropdown.innerHTML += `<option value="${req.id}">${req.name}</option>`;
    });
}

function refreshUI() {
    displayRequirements();
    populateRequirementDropdown();
}

