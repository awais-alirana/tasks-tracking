import {
    listenTasks,
    updateTask,
    listenMessages,
    addMessage,
    markMessagesRead
} from "./firebase.js";

// =====================
// LIVE STATE
// =====================
let tasks     = [];
let messages  = [];
let currentUser = JSON.parse(localStorage.getItem("currentUser"));

// Active unsubscribe holders
let unsubTasks     = null;
let unsubMessages  = null;

// =====================================================================
// EMPLOYEE PAGE LOGIC
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    if (!currentUser || currentUser.role !== "employee") {
        window.location.href = "index.html";
        return;
    } else {
        document.getElementById("user-name-display").textContent = currentUser.name;
        document.getElementById("user-avatar").textContent = currentUser.name.charAt(0).toUpperCase();
    }

    // Sidebar toggle
    const sidebar  = document.getElementById("sidebar");
    const overlay  = document.getElementById("sidebar-overlay");
    const btnOpen  = document.getElementById("sidebar-open");
    const btnClose = document.getElementById("sidebar-close");

    function openSidebar() {
        sidebar.classList.remove("-translate-x-full");
        overlay.classList.remove("hidden");
        setTimeout(() => overlay.classList.remove("opacity-0"), 10);
    }
    function closeSidebar() {
        sidebar.classList.add("-translate-x-full");
        overlay.classList.add("opacity-0");
        setTimeout(() => overlay.classList.add("hidden"), 300);
    }
    btnOpen.addEventListener("click", openSidebar);
    btnClose.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);

    document.querySelectorAll("#sidebar button[id^='nav-btn']").forEach(btn => {
        btn.addEventListener("click", () => { if (window.innerWidth < 768) closeSidebar(); });
    });

    const empNavBtnTasks       = document.getElementById("nav-btn-tasks");
    const empNavBtnChat        = document.getElementById("nav-btn-chat");
    const sectionTasks         = document.getElementById("section-tasks");
    const sectionChat          = document.getElementById("section-chat");
    const employeeTasksList    = document.getElementById("employee-tasks-list");
    const taskCounter          = document.getElementById("task-counter");
    const btnLogout            = document.getElementById("btn-logout");

    const empChatContactList   = document.getElementById("emp-chat-contact-list");
    const empChatMobileSelect  = document.getElementById("emp-chat-mobile-select");
    const empChatActiveAvatar  = document.getElementById("emp-chat-active-avatar");
    const empChatActiveName    = document.getElementById("emp-chat-active-name");
    const empChatMessages      = document.getElementById("emp-chat-messages");
    const empChatInput         = document.getElementById("emp-chat-input");
    const empChatSend          = document.getElementById("emp-chat-send");
    const filterDateEmployee   = document.getElementById("filter-date-employee");
    
    let activeChatContact = null;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    if (filterDateEmployee) filterDateEmployee.value = today;

    filterDateEmployee.addEventListener("change", renderEmployeeTasks);

    // ---- Nav toggle ----
    empNavBtnTasks.addEventListener("click", () => {
        empNavBtnTasks.classList.add("bg-slate-700","shadow-sm"); empNavBtnTasks.classList.remove("text-slate-100");
        empNavBtnChat.classList.remove("bg-slate-700","shadow-sm"); empNavBtnChat.classList.add("text-slate-100");
        sectionTasks.classList.remove("hidden"); sectionTasks.classList.add("flex");
        sectionChat.classList.add("hidden"); sectionChat.classList.remove("flex");
    });
    empNavBtnChat.addEventListener("click", () => {
        empNavBtnChat.classList.add("bg-slate-700","shadow-sm"); empNavBtnChat.classList.remove("text-slate-100");
        empNavBtnTasks.classList.remove("bg-slate-700","shadow-sm"); empNavBtnTasks.classList.add("text-slate-100");
        sectionChat.classList.remove("hidden"); sectionChat.classList.add("flex");
        sectionTasks.classList.add("hidden"); sectionTasks.classList.remove("flex");
        renderEmpChatList();
        renderEmpChatMessages();
    });

    btnLogout.addEventListener("click", () => { localStorage.removeItem("currentUser"); window.location.href = "index.html"; });

    function renderEmployeeTasks() {
        const selectedDate = filterDateEmployee.value;
        const myTasks = tasks.filter(task => (task.assignee === currentUser.name || task.assignee === "All Employees") && task.date === selectedDate);
        if (myTasks.length === 0) {
            employeeTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
                <i class="fa-solid fa-mug-hot text-4xl text-gray-300 mb-3"></i><p>No tasks found for ${selectedDate}.</p></div>`;
            taskCounter.textContent = '0 Pending';
            taskCounter.className = 'text-sm font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full w-max mt-2 sm:mt-0';
            return;
        }
        let pendingCount = 0;
        employeeTasksList.innerHTML = myTasks.map(task => {
            if (!task.completed) pendingCount++;
            return `
            <div class="task-item p-4 md:p-5 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-slate-200 shadow-sm'} mb-3 md:mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center transition-all hover:border-slate-300 hover:shadow-md">
                <div class="pt-1 hidden md:block">
                    <div class="w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${task.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-slate-500'}" onclick="window.handleToggleTask('${task.id}', ${task.completed})">
                        ${task.completed ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
                    </div>
                </div>
                <div class="flex-1">
                    <h4 class="text-lg font-bold ${task.completed ? 'text-gray-500 line-through' : 'text-gray-800'} mb-1">${task.title}</h4>
                    ${task.description ? `<p class="text-gray-600 text-sm mb-3 ${task.completed ? 'hidden' : ''}">${task.description}</p>` : ''}
                    ${task.remark ? `<div class="mt-2 mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-sm flex gap-2"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i><div><span class="font-bold">Reported Issue:</span> ${task.remark}</div></div>` : ''}
                    <div class="flex items-center justify-between mt-2 flex-wrap gap-3">
                        <span class="text-xs font-medium text-gray-500 flex items-center gap-1"><i class="fa-regular fa-calendar-check text-slate-400"></i> ${task.date} &bull; <span class="text-slate-600 font-semibold">${task.assignee}</span></span>
                        <div class="flex items-center gap-2">
                            ${!task.completed ? `
                                <button onclick="window.toggleRemarkInput('emp-${task.id}')" class="text-sm font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors border border-amber-200"><i class="fa-regular fa-comment-dots"></i> Issue</button>
                                <button onclick="window.handleToggleTask('${task.id}', ${task.completed})" class="text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200">Mark as Complete</button>
                            ` : `
                                <button onclick="window.handleToggleTask('${task.id}', ${task.completed})" class="text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-300">Undo</button>
                            `}
                        </div>
                    </div>
                    ${!task.completed ? `
                    <div id="remark-input-container-emp-${task.id}" class="mt-4 hidden animate-fadeIn">
                        <div class="flex gap-2">
                            <input type="text" id="remark-input-emp-${task.id}" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm placeholder-gray-400" placeholder="Describe the issue...">
                            <button onclick="window.handleSubmitRemarkEmp('${task.id}')" class="bg-amber-500 text-white font-medium px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm">Submit</button>
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');
        taskCounter.textContent = `${pendingCount} Pending`;
        if (pendingCount === 0) {
            taskCounter.className = 'text-sm font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full w-max mt-2 sm:mt-0';
            taskCounter.innerHTML = '<i class="fa-solid fa-champagne-glasses"></i> All Done!';
        } else {
            taskCounter.className = 'text-sm font-medium bg-slate-100 text-slate-800 px-3 py-1 rounded-full w-max mt-2 sm:mt-0';
        }
    }

    // ---- Chat: Render Contact List sidebar ----
    function renderEmpChatList() {
        const chatContacts = [{ name: "Team Leader" }, { name: "Manager" }];
        let mobileOptions = `<option value="">Select a contact...</option>`;
        empChatContactList.innerHTML = chatContacts.map(contact => {
            mobileOptions += `<option value="${contact.name}">${contact.name}</option>`;
            const isActive = activeChatContact === contact.name;
            const conversation = messages.filter(m => (m.sender === contact.name && m.receiver === currentUser.name) || (m.sender === currentUser.name && m.receiver === contact.name));
            const lastMsg = conversation.length > 0 ? conversation[conversation.length - 1].text : "No messages yet.";
            const unreadCount = messages.filter(m => m.sender === contact.name && m.receiver === currentUser.name && !m.read).length;
            
            const isLeader = contact.name === "Team Leader";

            return `
            <div class="p-3 bg-white border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50 border-l-4 border-l-indigo-600' : ''}" onclick="window.selectEmpChatContact('${contact.name}')">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-10 h-10 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-bold">
                            ${isLeader ? 'L' : 'M'}
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
        empChatMobileSelect.innerHTML = mobileOptions;
        if (activeChatContact) empChatMobileSelect.value = activeChatContact;
    }

    window.selectEmpChatContact = function(name) {
        activeChatContact = name;
        if (empChatMobileSelect) empChatMobileSelect.value = name;
        empChatActiveAvatar.classList.remove("hidden");
        empChatActiveAvatar.textContent = name === "Team Leader" ? "L" : "M";
        empChatActiveName.textContent = name;
        empChatInput.disabled = false;
        empChatSend.disabled = false;
        empChatInput.classList.remove("bg-gray-100", "cursor-not-allowed");
        empChatInput.classList.add("bg-white");
        empChatSend.classList.remove("bg-gray-400", "cursor-not-allowed");
        empChatSend.classList.add("bg-indigo-600", "hover:bg-indigo-700");
        markMessagesRead(name, currentUser.name);
        renderEmpChatList();
        renderEmpChatMessages();
        setTimeout(() => empChatInput.focus(), 100);
    };

    empChatMobileSelect.addEventListener("change", (e) => { if (e.target.value) window.selectEmpChatContact(e.target.value); });

    function renderEmpChatMessages() {
        if (!activeChatContact) return;
        const conversation = messages.filter(m =>
            (m.sender === activeChatContact && m.receiver === currentUser.name) ||
            (m.sender === currentUser.name && m.receiver === activeChatContact)
        );
        if (conversation.length === 0) {
            empChatMessages.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center p-6 opacity-60 m-auto"><i class="fa-regular fa-comments text-4xl mb-3 text-indigo-200"></i><p class="text-gray-600 text-sm">No messages yet.</p></div>`;
            return;
        }
        empChatMessages.innerHTML = `<div class="space-y-4 pt-2 pb-2">
            ${conversation.map(msg => {
                const isMe = msg.sender === currentUser.name;
                return `<div class="flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-4">
                    <div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}">
                        <p class="whitespace-pre-wrap break-words">${msg.text}</p>
                        <p class="text-[10px] mt-1 text-right ${isMe ? 'text-slate-300' : 'text-gray-400'}">${msg.time}</p>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
        empChatMessages.scrollTop = empChatMessages.scrollHeight;
    }

    async function sendEmpMessage() {
        const text = empChatInput.value.trim();
        if (!text || !activeChatContact) return;
        empChatInput.value = "";
        await addMessage({
            sender:   currentUser.name,
            receiver: activeChatContact,
            text,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
    }

    empChatSend.addEventListener("click", sendEmpMessage);
    empChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendEmpMessage(); });

    // ---- Global handlers ----
    window.handleToggleTask = async function(taskId, currentCompleted) {
        await updateTask(taskId, { completed: !currentCompleted });
    };

    window.handleSubmitRemarkEmp = async function(taskId) {
        const inputEl = document.getElementById(`remark-input-emp-${taskId}`);
        const remark = inputEl ? inputEl.value.trim() : "";
        if (remark) {
            await updateTask(taskId, { remark });
        } else {
            window.toggleRemarkInput(`emp-${taskId}`);
        }
    };

    window.toggleRemarkInput = function(prefixId) {
        const container = document.getElementById(`remark-input-container-${prefixId}`);
        const input = document.getElementById(`remark-input-${prefixId}`);
        if (!container) return;
        if (container.classList.contains("hidden")) { container.classList.remove("hidden"); input.focus(); }
        else { container.classList.add("hidden"); }
    };

    function updateUnreadBadges() {
        const badge = document.getElementById("nav-badge-chat");
        if (!badge) return;
        const unreadCount = messages.filter(m => m.receiver === currentUser.name && !m.read).length;
        if (unreadCount > 0) { badge.textContent = unreadCount; badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
    }

    // ---- Firestore Listeners ----
    unsubTasks = listenTasks((newTasks) => {
        tasks = newTasks;
        renderEmployeeTasks();
    });

    unsubMessages = listenMessages((newMessages) => {
        messages = newMessages;
        updateUnreadBadges();
        renderEmpChatList();
        renderEmpChatMessages();
    });
});
