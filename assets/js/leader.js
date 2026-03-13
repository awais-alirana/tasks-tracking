import {
    listenTasks,
    addTask,
    updateTask,
    deleteTask as fbDeleteTask,
    listenEmployees,
    addEmployee,
    deleteEmployee as fbDeleteEmployee,
    listenMessages,
    addMessage,
    markMessagesRead
} from "./firebase.js";

// =====================
// LIVE STATE
// =====================
let tasks     = [];
let employees = [];
let messages  = [];
let currentUser = JSON.parse(localStorage.getItem("currentUser"));

// Active unsubscribe holders
let unsubTasks     = null;
let unsubEmployees = null;
let unsubMessages  = null;

// =====================================================================
// LEADER PAGE LOGIC
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    // ---- DOM refs ----
    const navBtnAssign   = document.getElementById("nav-btn-assign");
    const navBtnMyTasks  = document.getElementById("nav-btn-my-tasks");
    const navBtnTasks    = document.getElementById("nav-btn-tasks");
    const navBtnManage   = document.getElementById("nav-btn-manage");
    const navBtnChat     = document.getElementById("nav-btn-chat");

    const sectionAssignTask = document.getElementById("section-assign-task");
    const sectionMyTasks    = document.getElementById("section-my-tasks");
    const sectionViewTasks  = document.getElementById("section-view-tasks");
    const sectionManageEmp  = document.getElementById("section-manage-emp");
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
    
    let activeChatContact = null;
    const filterDateLeader    = document.getElementById("filter-date-leader");
    const filterDateMyTasks   = document.getElementById("filter-date-my-tasks");
    const filterDateAllTasks  = document.getElementById("filter-date-all-tasks");

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    if (filterDateLeader) filterDateLeader.value = today;
    if (filterDateMyTasks) filterDateMyTasks.value = today;
    if (filterDateAllTasks) filterDateAllTasks.value = today;
    if (taskDateAssign) taskDateAssign.value = today;

    // ---- Nav helpers ----
    function activateNav(activeBtn) {
        [navBtnAssign, navBtnMyTasks, navBtnTasks, navBtnManage, navBtnChat].forEach(btn => {
            btn.classList.remove("bg-slate-700", "shadow-sm");
            btn.classList.add("text-slate-300");
        });
        activeBtn.classList.add("bg-slate-700", "shadow-sm");
        activeBtn.classList.remove("text-slate-300");
    }

    function showSection(activeSection) {
        [sectionAssignTask, sectionMyTasks, sectionViewTasks, sectionManageEmp, sectionChat].forEach(sec => {
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
                    date
                }));
                await Promise.all(promises);
            } else {
                await addTask({ title, description, assignee, completed: false, remark: "", date });
            }
            taskForm.reset();
            if (taskDateAssign) taskDateAssign.value = today;
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

    // ---- Dropdown ----
    function populateAssigneeDropdown() {
        let options = `<option value="Team Leader">Myself (Team Leader)</option>
                       <option value="All Employees">All Employees</option>`;
        employees.forEach(emp => { options += `<option value="${emp.name}">${emp.name}</option>`; });
        taskAssigneeInput.innerHTML = options;
    }

    // ---- Render: Assigned Tasks List ----
    function renderLeaderTasks() {
        const selectedDate = filterDateLeader.value;
        const filteredTasks = tasks.filter(t => t.date === selectedDate);

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
                        </div>
                        <span class="text-xs font-bold text-slate-600">${done}/${total} completed</span>
                    </div>
                    <h4 class="text-sm font-bold text-gray-800 mb-1">${sample.title}</h4>
                    ${sample.description ? `<p class="text-xs text-gray-500 mb-2">${sample.description}</p>` : ''}
                    <div class="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                        <div class="h-1.5 rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}" style="width:${pct}%"></div>
                    </div>
                    <div class="space-y-1">
                        ${group.map(t => `
                        <div class="flex items-center justify-between text-xs px-3 py-2 rounded-lg ${t.completed ? 'bg-green-50' : 'bg-gray-50'} border ${t.completed ? 'border-green-100' : 'border-gray-100'}">
                            <span class="flex items-center gap-2 font-medium text-gray-700">
                                <i class="fa-solid fa-user text-gray-400"></i> ${t.assignee}
                            </span>
                            <div class="flex items-center gap-2">
                                ${t.remark ? `<span class="text-amber-600 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${t.remark}</span>` : ''}
                                <span class="font-bold ${t.completed ? 'text-green-600' : 'text-amber-600'}">
                                    ${t.completed ? '<i class="fa-solid fa-check"></i> Done' : 'Pending'}
                                </span>
                                <button onclick="window.handleDeleteTask('${t.id}')" class="text-gray-300 hover:text-red-400 transition p-0.5" title="Delete">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>`;
        });

        soloTasks.forEach(task => {
            html += `
            <div class="task-item p-4 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-slate-200 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center w-full mb-3 last:mb-0 transition-all hover:border-slate-300">
                <div class="flex-1 w-full min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded ${task.completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${task.completed ? 'Completed' : 'Pending'}</span>
                        <span class="text-xs text-gray-400 truncate flex-1">Assigned: ${task.date}</span>
                        <div class="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded shrink-0">
                            <i class="fa-solid fa-user-circle text-slate-400"></i> <span class="truncate max-w-[100px]">${task.assignee}</span>
                        </div>
                    </div>
                    <h4 class="text-base font-bold text-gray-800 break-words line-clamp-2">${task.title}</h4>
                    ${task.description ? `<p class="text-gray-500 text-xs mt-1 break-words line-clamp-2 ${task.completed ? 'hidden' : ''}">${task.description}</p>` : ''}
                    ${task.remark ? `<div class="mt-2 p-2 bg-amber-50 rounded-lg text-amber-800 text-xs border border-amber-200"><span class="font-bold">Issue:</span> ${task.remark}</div>` : ''}
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
        const myTasks = tasks.filter(task => task.assignee === "Team Leader" && task.date === selectedDate);
        if (myTasks.length === 0) {
            myTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
                <i class="fa-solid fa-mug-hot text-4xl text-gray-300 mb-3"></i><p>No tasks found for ${selectedDate}.</p></div>`;
            return;
        }
        myTasksList.innerHTML = myTasks.map(task => {
            const statusBadge = task.completed
                ? `<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">Completed</span>`
                : `<span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Pending</span>`;
            return `
            <div class="task-item p-5 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-slate-200 shadow-sm'} mb-3 flex flex-col md:flex-row gap-4 items-start transition-all hover:border-slate-300 hover:shadow-md">
                <div class="flex-1 w-full">
                    <div class="flex justify-between items-start mb-2 gap-4 flex-wrap w-full">
                        <div class="min-w-0 pr-4 w-full md:w-auto flex-1">
                            <h4 class="${task.completed ? 'text-gray-500 line-through' : 'text-gray-800'} font-bold text-lg mb-1 break-words line-clamp-2">${task.title}</h4>
                            <div class="flex items-center gap-2 mb-2">${statusBadge}<span class="text-xs text-slate-500 font-semibold truncate"><i class="fa-regular fa-calendar shrink-0"></i> Assigned: ${task.date}</span></div>
                            ${task.description ? `<p class="text-gray-500 text-sm mt-2 break-words ${task.completed ? 'hidden' : ''}">${task.description}</p>` : ''}
                            ${task.remark ? `<div class="mt-3 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm border border-amber-200"><span class="font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Issue/Notes:</span> ${task.remark}</div>` : ''}
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
        const filteredTasks = tasks.filter(t => t.date === selectedDate);

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
                    ${userTasks.map(task => `
                        <div class="flex items-start justify-between p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'}">
                            <div class="flex items-start gap-3 w-full max-w-[85%]">
                                <div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}">
                                    ${task.completed ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                                </div>
                                <div class="flex-1">
                                    <p class="font-medium ${task.completed ? 'text-gray-500 line-through text-sm' : 'text-gray-800 text-sm'}">${task.title}</p>
                                    ${task.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">${task.description}</p>` : ''}
                                    ${task.remark ? `<div class="mt-1.5 p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs flex gap-1.5 items-start"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i> <span><strong>Issue:</strong> ${task.remark}</span></div>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-3 ml-4 flex-shrink-0 mt-0.5">
                                <span class="text-[10px] text-gray-400 font-medium">${task.date}</span>
                                <button onclick="window.handleDeleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition px-1" title="Delete Task"><i class="fa-solid fa-trash-can text-sm"></i></button>
                            </div>
                        </div>
                    `).join('')}
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
            const employeeTasksHtml = tasks.filter(task => task.assignee === emp.name).map(task => `
                <div class="flex items-start justify-between p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'} mb-2 last:mb-0">
                    <div class="flex items-start gap-3 w-full max-w-[85%]">
                        <div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}">
                            ${task.completed ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                        </div>
                        <div class="flex-1">
                            <p class="font-medium ${task.completed ? 'text-gray-500 line-through text-sm' : 'text-gray-800 text-sm'}">${task.title}</p>
                            ${task.description ? `<p class="text-xs text-gray-400 mt-0.5">${task.description}</p>` : ''}
                            ${task.remark ? `<div class="mt-1.5 p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs flex gap-1.5"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i><span><strong>Issue:</strong> ${task.remark}</span></div>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-3 ml-4 flex-shrink-0">
                        <span class="text-[10px] text-gray-400">${task.date}</span>
                        <button onclick="window.handleDeleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition px-1"><i class="fa-solid fa-trash-can text-sm"></i></button>
                    </div>
                </div>`).join('');
            return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 group">
                <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center group-hover:bg-slate-100 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs">${emp.name.charAt(0).toUpperCase()}</div>
                        <h3 class="font-bold text-slate-800">${emp.name}</h3>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-xs font-medium px-2 py-1 rounded-full ${empPendingTasks === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">${empPendingTasks} Pending</div>
                        <button onclick="window.handleDeleteEmployee('${emp.id}', '${emp.name}')" class="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50" title="Delete Employee"><i class="fa-solid fa-user-minus"></i></button>
                    </div>
                </div>
                <div class="p-4">${employeeTasksHtml || '<p class="text-sm text-gray-400 text-center py-4">No tasks assigned yet.</p>'}</div>
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
                return `<div class="flex w-full ${isLeader ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isLeader ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}">
                        <p>${msg.text}</p>
                        <p class="text-[10px] mt-1 text-right ${isLeader ? 'text-slate-300' : 'text-gray-400'}">${msg.time}</p>
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

    // Initial render
    populateAssigneeDropdown();
});
