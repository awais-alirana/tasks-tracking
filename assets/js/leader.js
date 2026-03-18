import {
    listenTasks,
    addTask,
    updateTask,
    deleteTask as fbDeleteTask,
    listenEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee as fbDeleteEmployee,
    listenMessages,
    addMessage,
    markMessagesRead,
    listenAllClients,
    addClient,
    updateClient,
    deleteClient,
    deleteMessage,
    clearChat
} from "./firebase.js";

// =====================
// LIVE STATE
// =====================
let tasks     = [];
let employees = [];
let messages  = [];
let clients   = [];
let currentUser = JSON.parse(localStorage.getItem("currentUser"));

// Active unsubscribe holders
let unsubTasks     = null;
let unsubEmployees = null;
let unsubMessages  = null;
let unsubClients   = null;

let editingClientId = null;

// =====================================================================
// LEADER PAGE LOGIC
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    // ---- DOM refs ----
    const navBtnAssign   = document.getElementById("nav-btn-assign");
    const navBtnMyTasks  = document.getElementById("nav-btn-my-tasks");
    const navBtnTasks    = document.getElementById("nav-btn-tasks");
    const navBtnManage   = document.getElementById("nav-btn-manage");
    const navBtnClients  = document.getElementById("nav-btn-clients");
    const navBtnChat     = document.getElementById("nav-btn-chat");

    const sectionAssignTask = document.getElementById("section-assign-task");
    const sectionMyTasks    = document.getElementById("section-my-tasks");
    const sectionViewTasks  = document.getElementById("section-view-tasks");
    const sectionManageEmp  = document.getElementById("section-manage-emp");
    const sectionClients    = document.getElementById("section-clients");
    const sectionChat       = document.getElementById("section-chat");

    const btnLogout        = document.getElementById("btn-logout");
    const taskForm         = document.getElementById("task-form");
    const taskTitleInput   = document.getElementById("task-title");
    const taskDescInput    = document.getElementById("task-desc");
    const taskAssigneeInput= document.getElementById("task-assignee");
    const taskDateAssign   = document.getElementById("task-date-assign");
    const leaderTasksList  = document.getElementById("leader-tasks-list");
    const myTasksList      = document.getElementById("my-tasks-list");
    const groupedTasksList = document.getElementById("grouped-tasks-list");

    const employeeForm  = document.getElementById("employee-form");
    const empNameInput  = document.getElementById("emp-name");
    const empPassInput  = document.getElementById("emp-pass");
    const employeeList  = document.getElementById("employee-list");

    const ldrChatEmpList      = document.getElementById("ldr-chat-emp-list");
    const ldrChatMobileSelect = document.getElementById("ldr-chat-mobile-select");
    const ldrChatActiveAvatar = document.getElementById("ldr-chat-active-avatar");
    const ldrChatActiveName   = document.getElementById("ldr-chat-active-name");
    const ldrChatMessages     = document.getElementById("ldr-chat-messages");
    const ldrChatInput        = document.getElementById("ldr-chat-input");
    const ldrChatSend         = document.getElementById("ldr-chat-send");

    const clientForm          = document.getElementById("client-form");
    const clientNameInput     = document.getElementById("client-name");
    const clientGmbInput      = document.getElementById("client-gmb");
    const clientWorkInput     = document.getElementById("client-work");
    const clientReportDateInput = document.getElementById("client-report-date");
    const clientsTableBody    = document.getElementById("clients-table-body");

    // Edit Modal DOM
    const editClientModal     = document.getElementById("edit-client-modal");
    const editClientForm      = document.getElementById("edit-client-form");
    const editClientName      = document.getElementById("edit-client-name");
    const editClientGmb       = document.getElementById("edit-client-gmb");
    const editClientWork      = document.getElementById("edit-client-work");
    const editClientReportDate = document.getElementById("edit-client-report-date");
    const editClientClose     = document.getElementById("edit-client-close");
    const editClientCancel    = document.getElementById("edit-client-cancel");
    const ldrChatClear        = document.getElementById("ldr-chat-clear");
    
    let activeChatContact = null;
    const filterDateLeader    = document.getElementById("filter-date-leader");
    const filterDateMyTasks   = document.getElementById("filter-date-my-tasks");
    const filterDateAllTasks  = document.getElementById("filter-date-all-tasks");

    // Set default date to today for assignment only
    const today = new Date().toISOString().split('T')[0];
    if (taskDateAssign) taskDateAssign.value = today;

    const filterAssigneeAllTasks = document.getElementById("filter-assignee-all-tasks");
    if (filterAssigneeAllTasks) filterAssigneeAllTasks.addEventListener("change", renderGroupedTasks);

    // ---- Nav helpers ----
    function activateNav(activeBtn) {
        [navBtnAssign, navBtnMyTasks, navBtnTasks, navBtnManage, navBtnClients, navBtnChat].forEach(btn => {
            if (!btn) return;
            btn.classList.remove("bg-slate-700", "shadow-sm");
            btn.classList.add("text-slate-300");
        });
        activeBtn.classList.add("bg-slate-700", "shadow-sm");
        activeBtn.classList.remove("text-slate-300");
    }

    function showSection(activeSection) {
        [sectionAssignTask, sectionMyTasks, sectionViewTasks, sectionManageEmp, sectionClients, sectionChat].forEach(sec => {
            if (!sec) return;
            sec.classList.remove("flex");
            sec.classList.add("hidden");
        });
        activeSection.classList.remove("hidden");
        activeSection.classList.add("flex");
    }

    // ---- Nav clicks ----
    navBtnAssign.addEventListener("click", () => { activateNav(navBtnAssign); showSection(sectionAssignTask); populateAssigneeDropdown(); });
    navBtnMyTasks.addEventListener("click", () => { activateNav(navBtnMyTasks); showSection(sectionMyTasks); renderLeaderMyTasks(); });
    navBtnTasks.addEventListener("click",   () => { activateNav(navBtnTasks);   showSection(sectionViewTasks); renderGroupedTasks(); });
    navBtnManage.addEventListener("click", () => { activateNav(navBtnManage); showSection(sectionManageEmp); renderEmployeeList(); });
    navBtnClients.addEventListener("click", () => { activateNav(navBtnClients); showSection(sectionClients); renderClientsTable(); });
    navBtnChat.addEventListener("click",   () => { activateNav(navBtnChat);   showSection(sectionChat); renderLdrChatEmpList(); renderLdrChatMessages(); });

    // Filter events
    filterDateLeader.addEventListener("change", renderLeaderTasks);
    filterDateMyTasks.addEventListener("change", renderLeaderMyTasks);
    filterDateAllTasks.addEventListener("change", renderGroupedTasks);

    // ---- Logout ----
    btnLogout.addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        window.location.href = "index.html";
    });

    // ---- Add Task ----
    taskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = taskForm.querySelector("button[type=submit]");
        const origHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const title       = taskTitleInput.value.trim();
        const description = taskDescInput.value.trim();
        const assignee    = taskAssigneeInput.value;
        const date        = taskDateAssign.value; 
        const deadline    = document.getElementById("task-deadline") ? document.getElementById("task-deadline").value : "";

        try {
            if (assignee === "All Employees") {
                if (employees.length === 0) {
                    alert("No employees found. Add employees first.");
                    btn.disabled = false; btn.innerHTML = origHtml;
                    return;
                }
                const groupId = "grp_" + Date.now();
                const promises = employees.map(emp => addTask({
                    title, description,
                    assignee:  emp.name,
                    groupId,
                    groupTotal: employees.length,
                    completed: false,
                    remark: "",
                    date,
                    deadline
                }));
                await Promise.all(promises);
            } else {
                await addTask({ title, description, assignee, completed: false, remark: "", date, deadline });
            }
            taskForm.reset();
            if (taskDateAssign) taskDateAssign.value = today;
            const tDeadline = document.getElementById("task-deadline");
            if (tDeadline) tDeadline.value = "";
        } catch(err) {
            console.error("Task save failed:", err);
            alert("Task could not be saved. Check console.");
        } finally {
            btn.disabled = false; btn.innerHTML = origHtml;
        }
    });

    // ---- Add Employee ----
    employeeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = empNameInput.value.trim();
        const pass = empPassInput.value.trim();
        if (!name || !pass) return;
        const exists = employees.some(emp => emp.name.toLowerCase() === name.toLowerCase());
        if (exists) { alert("Employee already exists!"); return; }
        const btn = employeeForm.querySelector("button[type=submit]");
        const origBtnHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
        try {
            await addEmployee({ name, pass });
            empNameInput.value = "";
            empPassInput.value = "";
            empNameInput.focus();
        } catch(err) {
            console.error("Failed to add employee:", err);
            alert("Employee could not be saved. Please check Firebase rules.");
        } finally {
            btn.disabled = false; btn.innerHTML = origBtnHtml;
        }
    });

    // ---- Add Client ----
    if (clientForm) {
        clientForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = clientForm.querySelector("button[type=submit]");
            const origHtml = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            const name = clientNameInput.value.trim();
            const gmb = clientGmbInput.value.trim();
            const work = clientWorkInput.value.trim();
            const reportDate = clientReportDateInput.value;

            try {
                await addClient({
                    name,
                    gmb,
                    work,
                    reportDate,
                    active: true,
                    employeeName: "All" // Global
                });
                clientForm.reset();
            } catch (err) {
                console.error("Client add failed:", err);
                alert("Failed to add client.");
            } finally {
                btn.disabled = false; btn.innerHTML = origHtml;
            }
        });
    }

    function renderClientsTable() {
        if (!clientsTableBody) return;
        if (clients.length === 0) {
            clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">No clients found. Add one above.</td></tr>`;
            return;
        }

        clientsTableBody.innerHTML = clients.map((client, index) => {
            const isActive = client.active !== false; 
            return `
                <tr class="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 text-gray-500 font-medium">${index + 1}</td>
                    <td class="px-4 py-3 font-bold text-gray-800 max-w-[200px] break-words whitespace-normal">${client.name}</td>
                    <td class="px-4 py-3 text-gray-600 max-w-[150px] break-words whitespace-normal">${client.work || '-'}</td>
                    <td class="px-4 py-3">
                        <a href="${client.gmb}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1">
                            <i class="fa-solid fa-location-dot text-xs"></i> View GMB
                        </a>
                    </td>
                    <td class="px-4 py-3">
                        <button onclick="window.toggleClientStatus('${client.id}', ${isActive})" class="px-2.5 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${isActive ? 'Active' : 'Inactive'}
                        </button>
                    </td>
                    <td class="px-4 py-3 text-gray-600 font-medium">${client.reportDate}</td>
                    <td class="px-4 py-3 flex items-center gap-1">
                        <button onclick="window.editClient('${client.id}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="window.handleDeleteClient('${client.id}')" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Delete">
                            <i class="fa-solid fa-trash-can pointer-events-none"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.toggleClientStatus = async function(clientId, currentStatus) {
        try {
            await updateClient(clientId, { active: !currentStatus });
        } catch (err) {
            console.error("Status update failed:", err);
            alert("Status update failed.");
        }
    };

    window.handleDeleteClient = async function(clientId) {
        if (confirm("Are you sure you want to delete this client?")) {
            try {
                await deleteClient(clientId);
            } catch (err) {
                console.error("Delete failed:", err);
                alert("Delete failed: " + err.message);
            }
        }
    }

    window.editClient = function(clientId) {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        
        editClientName.value = client.name || "";
        editClientGmb.value = client.gmb || "";
        editClientWork.value = client.work || "";
        editClientReportDate.value = client.reportDate || "";
        
        editingClientId = clientId;
        if (editClientModal) editClientModal.classList.remove("hidden");
    };

    function closeEditModal() {
        editingClientId = null;
        if (editClientForm) editClientForm.reset();
        if (editClientModal) editClientModal.classList.add("hidden");
    }

    if (editClientClose)  editClientClose.addEventListener("click", closeEditModal);
    if (editClientCancel) editClientCancel.addEventListener("click", closeEditModal);
    if (editClientModal) {
        editClientModal.addEventListener("click", (e) => {
            if (e.target === editClientModal) closeEditModal();
        });
    }

    if (editClientForm) {
        editClientForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!editingClientId) return;

            const btn = document.getElementById("edit-client-submit");
            const origHtml = btn ? btn.innerHTML : "";
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...'; }

            const name = editClientName.value.trim();
            const gmb = editClientGmb.value.trim();
            const work = editClientWork.value.trim();
            const reportDate = editClientReportDate.value;

            try {
                await updateClient(editingClientId, { name, gmb, work, reportDate });
                closeEditModal();
            } catch (err) {
                console.error("Update failed:", err);
                alert("Update failed: " + err.message);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
            }
        });
    }

    // ---- Dropdown ----
    function populateAssigneeDropdown() {
        let options = `<option value="Team Leader">Myself (Team Leader)</option>
                       <option value="All Employees">All Employees</option>`;
        employees.forEach(emp => { options += `<option value="${emp.name}">${emp.name}</option>`; });
        taskAssigneeInput.innerHTML = options;

        const filterAssigneeAllTasks = document.getElementById("filter-assignee-all-tasks");
        if (filterAssigneeAllTasks) {
            let filterOptions = `<option value="">-- Select Employee --</option>`;
            employees.forEach(emp => { filterOptions += `<option value="${emp.name}">${emp.name}</option>`; });
            filterAssigneeAllTasks.innerHTML = filterOptions;
        }
    }

    // ---- Render: Assigned Tasks List ----
    function renderLeaderTasks() {
        const selectedDate = filterDateLeader.value;
        const filteredTasks = tasks.filter(t => {
            if (selectedDate) return t.date === selectedDate;
            return !t.completed;
        });

        if (filteredTasks.length === 0) {
            leaderTasksList.innerHTML = `<div class="text-center text-gray-500 py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">No tasks found for ${selectedDate}.</div>`;
            return;
        }

        const groupMap = {};
        const soloTasks = [];

        filteredTasks.forEach(task => {
            if (task.groupId) {
                if (!groupMap[task.groupId]) groupMap[task.groupId] = [];
                groupMap[task.groupId].push(task);
            } else {
                soloTasks.push(task);
            }
        });

        let html = '';
        Object.values(groupMap).forEach(group => {
            const total     = group.length;
            const done      = group.filter(t => t.completed).length;
            const allDone   = done === total;
            const pct       = Math.round((done / total) * 100);
            const sample    = group[0];

            html += `
            <div class="rounded-xl border ${allDone ? 'bg-green-50 border-green-200 opacity-80' : 'bg-white border-slate-200 shadow-sm'} mb-4 overflow-hidden">
                <div class="p-4">
                    <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-2 py-0.5 rounded ${allDone ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
                                ${allDone ? 'All Done' : 'Group Task'}
                            </span>
                            <span class="text-xs text-gray-400">Assigned: ${sample.date}</span>
                            ${sample.deadline ? `<span class="text-xs text-amber-600 font-bold flex items-center gap-1"><i class="fa-solid fa-hourglass-half"></i> Due: ${sample.deadline}</span>` : ''}
                        </div>
                        <span class="text-xs font-bold text-slate-600">${done}/${total} completed</span>
                    </div>
                    <h4 class="text-sm font-bold text-gray-800 mb-1">${sample.title}</h4>
                    ${sample.description ? `<p class="text-xs text-gray-500 mb-2">${sample.description}</p>` : ''}
                    <div class="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                        <div class="h-1.5 rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}" style="width:${pct}%"></div>
                    </div>
                    <div class="space-y-1">
                        ${group.map(t => {
                            const isOverdue = t.deadline && t.deadline < today && !t.completed;
                            return `
                        <div class="flex items-center justify-between text-xs px-3 py-2 rounded-lg ${t.completed ? 'bg-green-50' : isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-gray-50'} border ${t.completed ? 'border-green-100' : isOverdue ? 'border-red-200' : 'border-gray-100'}">
                            <span class="flex items-center gap-2 font-medium text-gray-700">
                                <i class="fa-solid fa-user text-gray-400"></i> ${t.assignee}
                            </span>
                            <div class="flex items-center gap-2">
                                ${isOverdue ? `<span class="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Overdue</span>` : ''}
                                ${t.remark ? `<span class="text-amber-600 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${t.remark}</span>` : ''}
                                <span class="font-bold ${t.completed ? 'text-green-600' : 'text-amber-600'}">
                                    ${t.completed ? '<i class="fa-solid fa-check"></i> Done' : 'Pending'}
                                </span>
                                <button onclick="window.handleDeleteTask('${t.id}')" class="text-gray-300 hover:text-red-400 transition p-0.5" title="Delete">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        });

        soloTasks.forEach(task => {
            const isOverdue = task.deadline && task.deadline < today && !task.completed;
            html += `
            <div class="task-item p-4 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : isOverdue ? 'border-red-400 bg-red-100/90 shadow-sm' : 'bg-white border-slate-200 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center w-full mb-3 last:mb-0 transition-all hover:border-slate-300">
                <div class="flex-1 w-full min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded ${task.completed ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}</span>
                        <span class="text-xs text-slate-400">Assigned: ${task.date}</span>
                        ${task.deadline ? `<span class="text-xs ${isOverdue ? 'text-red-600' : 'text-amber-600'} font-bold flex items-center gap-1"><i class="fa-solid fa-hourglass-half"></i> Due: ${task.deadline}</span>` : ''}
                        <div class="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            <i class="fa-solid fa-user-circle text-slate-400"></i> <span class="truncate max-w-[100px]">${task.assignee}</span>
                        </div>
                    </div>
                    <h4 class="text-base font-bold text-gray-800 break-words line-clamp-2">${task.title}</h4>
                    ${task.description ? `<p class="text-gray-500 text-xs mt-1 break-words line-clamp-2 ${task.completed ? 'hidden' : ''}">${task.description}</p>` : ''}
                    ${task.remark ? `<div class="mt-2 p-2 bg-amber-50 rounded-lg text-amber-800 text-xs border border-amber-200 break-all"><span class="font-bold">Issue:</span> ${task.remark}</div>` : ''}
                </div>
                <button onclick="window.handleDeleteTask('${task.id}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100 shrink-0 m-auto md:m-0" title="Delete Task">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;
        });

        leaderTasksList.innerHTML = html || `<div class="text-center text-gray-500 py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">No tasks assigned yet.</div>`;
    }

    // ---- Render: My Tasks (Leader's own) ----
    function renderLeaderMyTasks() {
        const selectedDate = filterDateMyTasks.value;
        const myTasks = tasks.filter(task => {
            const matchesUser = task.assignee === "Team Leader";
            if (!matchesUser) return false;
            if (selectedDate) return task.date === selectedDate;
            return !task.completed;
        });
        if (myTasks.length === 0) {
            myTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
                <i class="fa-solid fa-mug-hot text-4xl text-gray-300 mb-3"></i><p>No tasks found for ${selectedDate}.</p></div>`;
            return;
        }
        myTasksList.innerHTML = myTasks.map(task => {
            const isOverdue = task.deadline && task.deadline < today && !task.completed;
            const statusBadge = task.completed
                ? `<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">Completed</span>`
                : isOverdue
                    ? `<span class="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">Overdue</span>`
                    : `<span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Pending</span>`;
            return `
            <div class="task-item p-5 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : isOverdue ? 'border-red-400 bg-red-100/90 shadow-sm' : 'bg-white border-slate-200 shadow-sm'} mb-3 flex flex-col md:flex-row gap-4 items-start transition-all hover:border-slate-300 hover:shadow-md">
                <div class="flex-1 w-full">
                    <div class="flex justify-between items-start mb-2 gap-4 flex-wrap w-full">
                        <div class="min-w-0 pr-4 w-full md:w-auto flex-1">
                             <h4 class="${task.completed ? 'text-gray-500 line-through' : 'text-gray-800'} font-bold text-lg mb-1 break-words line-clamp-2">${task.title}</h4>
                             <div class="flex flex-wrap items-center gap-2 mb-2">${statusBadge}
                                 <span class="text-xs text-slate-500 font-semibold truncate"><i class="fa-regular fa-calendar"></i> Assigned: ${task.date}</span>
                                 ${task.deadline ? `<span class="text-xs text-amber-600 font-bold flex items-center gap-1"><i class="fa-solid fa-hourglass-half"></i> Due: ${task.deadline}</span>` : ''}
                             </div>
                            ${task.description ? `<p class="text-gray-500 text-sm mt-2 break-words ${task.completed ? 'hidden' : ''}">${task.description}</p>` : ''}
                            ${task.remark ? `<div class="mt-3 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm border border-amber-200 break-all"><span class="font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Issue/Notes:</span> ${task.remark}</div>` : ''}
                        </div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 items-center justify-between w-full">
                        <div class="flex gap-2">
                            ${!task.completed ? `
                                <button onclick="window.toggleRemarkInput('${task.id}')" class="text-xs font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors border border-amber-200 shrink-0">
                                    <i class="fa-regular fa-comment-dots"></i> Add Remark
                                </button>` : ''}
                        </div>
                        <div class="flex items-center gap-2 shrink-0 md:w-auto">
                            ${!task.completed ? `
                                <button onclick="window.handleToggleTask('${task.id}', ${task.completed})" class="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 shrink-0">Mark as Complete</button>
                            ` : `
                                <button onclick="window.handleToggleTask('${task.id}', ${task.completed})" class="text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-300 shrink-0">Undo</button>
                            `}
                            <button onclick="window.handleDeleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition p-2 bg-gray-50 hover:bg-red-50 rounded-lg" title="Delete Task">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    ${!task.completed ? `
                    <div id="remark-input-container-${task.id}" class="mt-4 hidden animate-fadeIn">
                        <div class="flex gap-2">
                            <input type="text" id="remark-input-${task.id}" class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm placeholder-gray-400" placeholder="Describe the issue...">
                            <button onclick="window.handleSubmitRemark('${task.id}')" class="bg-amber-500 text-white font-medium px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm">Submit</button>
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ---- Render: Grouped Tasks ----
    function renderGroupedTasks() {
        const selectedDate = filterDateAllTasks.value;
        const filterAssigneeAllTasks = document.getElementById("filter-assignee-all-tasks");
        const selectedAssignee = filterAssigneeAllTasks ? filterAssigneeAllTasks.value : "";

        if (!selectedAssignee) {
            groupedTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center"><i class="fa-solid fa-user-circle text-4xl mb-3 text-slate-400"></i><p class="font-medium">Please select an employee to view the task overview.</p></div>`;
            return;
        }

        const filteredTasks = tasks.filter(t => {
            const matchesAssignee = t.assignee === selectedAssignee;
            if (!matchesAssignee) return false;

            if (selectedDate) return t.date === selectedDate;
            return true; // Show all tasks for exact assignee
        });

        if (filteredTasks.length === 0) {
            groupedTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">No tasks found for ${selectedDate}.</div>`;
            return;
        }
        const grouped = {};
        filteredTasks.forEach(task => {
            if (!grouped[task.assignee]) grouped[task.assignee] = [];
            grouped[task.assignee].push(task);
        });
        let html = '';
        for (const [assignee, userTasks] of Object.entries(grouped)) {
            const total = userTasks.length;
            const completed = userTasks.filter(t => t.completed).length;
            const percent = Math.round((completed / total) * 100);
            html += `
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div class="bg-gray-50 px-6 py-4 flex justify-between items-center border-b border-gray-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-lg">
                            ${assignee === 'All Employees' ? '<i class="fa-solid fa-users"></i>' : assignee.charAt(0).toUpperCase()}
                        </div>
                        <div><h3 class="font-bold text-gray-800 text-lg">${assignee}</h3><p class="text-xs text-gray-500">${total} assigned tasks</p></div>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-sm font-bold ${percent === 100 ? 'text-green-600' : 'text-slate-600'}">${percent}% Done</span>
                        <div class="w-24 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div class="h-full ${percent === 100 ? 'bg-green-500' : 'bg-slate-500'}" style="width:${percent}%"></div>
                        </div>
                    </div>
                </div>
                <div class="p-4 space-y-2">
                    ${userTasks.map(task => {
                        const isOverdue = task.deadline && task.deadline < today && !task.completed;
                        return `
                        <div class="flex items-start justify-between p-3 rounded-lg border ${task.completed ? 'bg-green-100 border-green-200 shadow-sm' : isOverdue ? 'bg-red-100/90 border-red-400 shadow-sm' : 'bg-white border-gray-100'}">
                            <div class="flex items-start gap-3 w-full max-w-[85%]">
                                <div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}">
                                    ${task.completed ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                                </div>
                                <div class="flex-1">
                                    <p class="font-medium ${task.completed ? 'text-gray-500 line-through text-sm' : 'text-gray-800 text-sm'}">${task.title}</p>
                                    ${task.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">${task.description}</p>` : ''}
                                    ${task.remark ? `<div class="mt-1.5 p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs flex gap-1.5 items-start"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i> <span class="break-all"><strong>Issue:</strong> ${task.remark}</span></div>` : ''}
                                    ${task.deadline ? `<div class="mt-1 p-1 bg-amber-50/50 rounded border border-amber-100 text-amber-700 text-[10px] flex gap-1 items-center max-w-max"><i class="fa-solid fa-hourglass-half text-[10px]"></i> <span><strong>Due:</strong> ${task.deadline}</span></div>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-3 ml-4 flex-shrink-0 mt-0.5">
                                <span class="text-[10px] text-gray-400 font-medium">${task.date}</span>
                                <button onclick="window.handleDeleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition px-1" title="Delete Task"><i class="fa-solid fa-trash-can text-sm"></i></button>
                            </div>
                        </div>`;
                        }).join('')}
                </div>
            </div>`;
        }
        groupedTasksList.innerHTML = html;
    }

    // ---- Render: Employee List ----
    function renderEmployeeList() {
        if (employees.length === 0) {
            employeeList.innerHTML = `<div class="col-span-full text-center text-gray-500 py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">No employees added yet.</div>`;
            return;
        }
        employeeList.innerHTML = employees.map(emp => {
            const empPendingTasks = tasks.filter(task => task.assignee === emp.name && !task.completed).length;
            return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 group">
                <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center group-hover:bg-slate-100 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs">${emp.name.charAt(0).toUpperCase()}</div>
                        <h3 class="font-bold text-slate-800">${emp.name}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="text-xs font-medium px-2 py-1 rounded-full ${empPendingTasks === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">${empPendingTasks} Pending</div>
                        <button onclick="window.handleEditEmployee('${emp.id}')" class="text-gray-400 hover:text-blue-500 transition p-1.5 rounded-lg hover:bg-blue-50" title="Edit Employee"><i class="fa-solid fa-user-gear"></i></button>
                        <button onclick="window.handleDeleteEmployee('${emp.id}', '${emp.name}')" class="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50" title="Delete Employee"><i class="fa-solid fa-user-minus"></i></button>
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100 space-y-2 text-sm text-slate-600 bg-white">
                     <p><span class="font-semibold text-slate-700">Password:</span> <span class="text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 select-all">${emp.password || '******'}</span></p>
                </div>
            </div>`;
        }).join('');
    }

    // ---- Chat: Render Contact List sidebar ----
    function renderLdrChatEmpList() {
        const chatContacts = [{ name: "Manager" }, ...employees];
        let mobileOptions = `<option value="">Select a contact...</option>`;
        ldrChatEmpList.innerHTML = chatContacts.map(contact => {
            mobileOptions += `<option value="${contact.name}">${contact.name}</option>`;
            const isActive = activeChatContact === contact.name;
            const conversation = messages.filter(m => (m.sender === contact.name && m.receiver === "Team Leader") || (m.sender === "Team Leader" && m.receiver === contact.name));
            const lastMsg = conversation.length > 0 ? conversation[conversation.length - 1].text : "No messages yet.";
            const unreadCount = messages.filter(m => m.sender === contact.name && m.receiver === "Team Leader" && !m.read).length;
            
            const isManager = contact.name === "Manager";

            return `
            <div class="p-3 bg-white border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50 border-l-4 border-l-slate-600' : ''}" onclick="window.selectLdrChatContact('${contact.name}')">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-10 h-10 rounded-full ${isActive ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-bold">
                            ${isManager ? '<i class="fa-solid fa-user-shield text-sm"></i>' : contact.name.charAt(0).toUpperCase()}
                        </div>
                        ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">${unreadCount}</span>` : ''}
                    </div>
                    <div class="flex-1 min-w-0 pr-2">
                        <h4 class="font-bold text-gray-800 text-sm truncate">${contact.name}</h4>
                        <p class="text-xs ${unreadCount > 0 ? 'text-gray-800 font-bold' : 'text-gray-500'} truncate">${lastMsg}</p>
                    </div>
                </div>
            </div>`;
        }).join('');
        ldrChatMobileSelect.innerHTML = mobileOptions;
        if (activeChatContact) ldrChatMobileSelect.value = activeChatContact;
    }

    window.selectLdrChatContact = function(name) {
        activeChatContact = name;
        if (ldrChatMobileSelect) ldrChatMobileSelect.value = name;
        ldrChatActiveAvatar.classList.remove("hidden");
        ldrChatActiveAvatar.textContent = name === "Manager" ? "M" : name.charAt(0).toUpperCase();
        ldrChatActiveName.textContent = name;
        ldrChatInput.disabled = false;
        ldrChatSend.disabled = false;
        ldrChatInput.classList.remove("bg-gray-100", "cursor-not-allowed");
        ldrChatInput.classList.add("bg-white");
        ldrChatSend.classList.remove("bg-gray-400", "cursor-not-allowed");
        ldrChatSend.classList.add("bg-slate-800", "hover:bg-slate-900");
        if (ldrChatClear) ldrChatClear.classList.remove("hidden");
        markMessagesRead(name, "Team Leader");
        renderLdrChatEmpList();
        renderLdrChatMessages();
        setTimeout(() => ldrChatInput.focus(), 100);
    };

    ldrChatMobileSelect.addEventListener("change", (e) => { if (e.target.value) window.selectLdrChatContact(e.target.value); });

    function renderLdrChatMessages() {
        if (!activeChatContact) return;
        const conversation = messages.filter(m =>
            (m.sender === activeChatContact && m.receiver === "Team Leader") ||
            (m.sender === "Team Leader" && m.receiver === activeChatContact)
        );
        if (conversation.length === 0) {
            ldrChatMessages.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center p-6 opacity-60 m-auto"><i class="fa-regular fa-comments text-4xl mb-3 text-slate-300"></i><p class="text-gray-600 text-sm">No messages yet.</p></div>`;
            return;
        }
        ldrChatMessages.innerHTML = `<div class="space-y-4 pt-2 pb-2">
            ${conversation.map(msg => {
                const isLeader = msg.sender === "Team Leader";
                return `<div class="flex w-full ${isLeader ? 'justify-end' : 'justify-start'} group">
                    <div class="relative max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isLeader ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}">
                        <p>${msg.text}</p>
                        <div class="flex items-center justify-between mt-1 gap-2">
                            <button onclick="window.handleDeleteMessage('${msg.id}')" class="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-600 transition-all pr-1" title="Delete message">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <p class="text-[10px] ${isLeader ? 'text-slate-300' : 'text-gray-400'} ml-auto">${msg.time}</p>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
        ldrChatMessages.scrollTop = ldrChatMessages.scrollHeight;
    }

    async function sendLdrMessage() {
        const text = ldrChatInput.value.trim();
        if (!text || !activeChatContact) return;
        ldrChatInput.value = "";
        await addMessage({
            sender:   "Team Leader",
            receiver: activeChatContact,
            text,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
    }

    window.handleDeleteMessage = async function(msgId) {
        try {
            await deleteMessage(msgId);
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    ldrChatSend.addEventListener("click", sendLdrMessage);
    ldrChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendLdrMessage(); });

    // ---- Global handlers (scoped for this role) ----
    window.handleToggleTask = async function(taskId, currentCompleted) {
        await updateTask(taskId, { completed: !currentCompleted });
    };

    window.handleSubmitRemark = async function(taskId) {
        const inputEl = document.getElementById(`remark-input-${taskId}`);
        const remark = inputEl ? inputEl.value.trim() : "";
        if (remark) {
            await updateTask(taskId, { remark });
        } else {
            window.toggleRemarkInput(taskId);
        }
    };

    window.handleDeleteTask = async function(taskId) {
        await fbDeleteTask(taskId);
    };

    window.handleDeleteEmployee = async function(empId, empName) {
        if (confirm(`Delete employee "${empName}"? This will NOT delete their tasks.`)) {
            await fbDeleteEmployee(empId);
        }
    };

    window.toggleRemarkInput = function(taskId) {
        const container = document.getElementById(`remark-input-container-${taskId}`);
        const input = document.getElementById(`remark-input-${taskId}`);
        if (!container) return;
        if (container.classList.contains("hidden")) {
            container.classList.remove("hidden");
            input.focus();
        } else {
            container.classList.add("hidden");
        }
    };

    function updateUnreadBadges() {
        const badge = document.getElementById("nav-badge-chat");
        if (!badge) return;
        const unreadCount = messages.filter(m => m.receiver === "Team Leader" && !m.read).length;
        if (unreadCount > 0) { badge.textContent = unreadCount; badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
    }

    // ---- Firestore Listeners ----
    unsubTasks = listenTasks((newTasks) => {
        tasks = newTasks;
        renderLeaderTasks();
        renderLeaderMyTasks();
        renderGroupedTasks();
        renderEmployeeList();
    });

    unsubEmployees = listenEmployees((newEmployees) => {
        employees = newEmployees;
        populateAssigneeDropdown();
        renderEmployeeList();
        renderLdrChatEmpList();
    });

    unsubMessages = listenMessages((newMessages) => {
        messages = newMessages;
        updateUnreadBadges();
        renderLdrChatEmpList();
        if (activeChatContact) renderLdrChatMessages();
    });

    unsubClients = listenAllClients((newClients) => {
        clients = newClients;
        if (typeof renderClientsTable === "function") renderClientsTable();
    });

    // ---- Edit Employee Modal Handlers ----
    const editEmpModal = document.getElementById("edit-employee-modal");
    const editEmpForm  = document.getElementById("edit-employee-form");
    const editEmpId    = document.getElementById("edit-emp-id");
    const editEmpName  = document.getElementById("edit-emp-name");
    const editEmpPass  = document.getElementById("edit-emp-pass");
    const editEmpClose = document.getElementById("edit-emp-close");
    const editEmpCancel= document.getElementById("edit-emp-cancel");

    window.handleEditEmployee = (empId) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;
        editEmpId.value = emp.id;
        editEmpName.value = emp.name;
        editEmpPass.value = emp.password || "";
        if (editEmpModal) editEmpModal.classList.remove("hidden");
    };

    function closeEditEmpModal() {
        if (editEmpModal) editEmpModal.classList.add("hidden");
        editEmpForm.reset();
    }

    if (editEmpClose) editEmpClose.addEventListener("click", closeEditEmpModal);
    if (editEmpCancel) editEmpCancel.addEventListener("click", closeEditEmpModal);

    if (editEmpForm) {
        editEmpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = editEmpId.value;
            const newPass = editEmpPass.value.trim();
            if (!newPass) return alert("Password cannot be empty");

            try {
                await updateEmployee(id, { password: newPass });
                alert("Employee password updated successfully!");
                closeEditEmpModal();
            } catch (err) {
                console.error(err);
                alert("Error updating employee: " + err.message);
            }
        });
    }

    // Initial render
    populateAssigneeDropdown();
});
