import {
    listenTasks,
    listenEmployees,
    listenMessages,
    addMessage,
    markMessagesRead,
    listenAllClients,
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

// =====================================================================
// MANAGER PAGE LOGIC
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    if (!currentUser || currentUser.role !== "manager") {
        window.location.href = "index.html";
        return;
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

    const navBtnManagerTasks = document.getElementById("nav-btn-manager-tasks");
    const navBtnManagerChat  = document.getElementById("nav-btn-manager-chat");
    const navBtnManagerClients = document.getElementById("nav-btn-manager-clients");
    const mgrChatClear       = document.getElementById("mgr-chat-clear");

    const sectionManagerViewTasks = document.getElementById("section-manager-view-tasks");
    const sectionManagerChat      = document.getElementById("section-manager-chat");
    const sectionManagerClients   = document.getElementById("section-manager-clients");

    const managerClientsTableBody = document.getElementById("manager-clients-table-body");

    const btnLogout       = document.getElementById("btn-logout");
    const managerAllTasksList = document.getElementById("manager-all-tasks-list");
    const filterDateManager   = document.getElementById("filter-date-manager");

    const mgrChatContactList  = document.getElementById("mgr-chat-contact-list");
    const mgrChatMobileSelect = document.getElementById("mgr-chat-mobile-select");
    const mgrChatActiveAvatar = document.getElementById("mgr-chat-active-avatar");
    const mgrChatActiveName   = document.getElementById("mgr-chat-active-name");
    const mgrChatMessages     = document.getElementById("mgr-chat-messages");
    const mgrChatInput        = document.getElementById("mgr-chat-input");
    const mgrChatSend         = document.getElementById("mgr-chat-send");

    let activeChatContact = null;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];

    filterDateManager.addEventListener("change", renderManagerTasks);
    btnLogout.addEventListener("click", () => { localStorage.removeItem("currentUser"); window.location.href = "index.html"; });

    // ---- Nav helpers ----
    function activateNav(activeBtn) {
        [navBtnManagerTasks, navBtnManagerChat, navBtnManagerClients].forEach(btn => {
            if (!btn) return;
            btn.classList.remove("bg-slate-700", "shadow-sm");
            btn.classList.add("text-slate-300");
        });
        activeBtn.classList.add("bg-slate-700", "shadow-sm");
        activeBtn.classList.remove("text-slate-300");
    }

    function showSection(activeSection) {
        [sectionManagerViewTasks, sectionManagerChat, sectionManagerClients].forEach(sec => {
            if (!sec) return;
            sec.classList.remove("flex");
            sec.classList.add("hidden");
        });
        activeSection.classList.remove("hidden");
        activeSection.classList.add("flex");
    }

    navBtnManagerTasks.addEventListener("click", () => { activateNav(navBtnManagerTasks); showSection(sectionManagerViewTasks); renderManagerTasks(); });
    navBtnManagerChat.addEventListener("click",  () => { activateNav(navBtnManagerChat);  showSection(sectionManagerChat); renderMgrChatList(); renderMgrChatMessages(); });
    navBtnManagerClients.addEventListener("click", () => { activateNav(navBtnManagerClients); showSection(sectionManagerClients); renderClientsTable(); });

    function renderManagerTasks() {
        const selectedDate = filterDateManager.value;
        const filteredTasks = tasks.filter(t => {
            if (selectedDate) return t.date === selectedDate;
            return !t.completed;
        });
        if (filteredTasks.length === 0) {
            managerAllTasksList.innerHTML = `<div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center"><i class="fa-solid fa-clipboard text-4xl text-gray-300 mb-3"></i><p>No tasks found for ${selectedDate}.</p></div>`;
            return;
        }
        const uniqueAssignees = [...new Set(filteredTasks.map(t => t.assignee))];
        let html = "";
        uniqueAssignees.forEach(assignee => {
            const assigneeTasks = filteredTasks.filter(t => t.assignee === assignee);
            const completedTasks = assigneeTasks.filter(t => t.completed).length;
            const totalTasks = assigneeTasks.length;
            const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
            const taskListHtml = assigneeTasks.map(task => {
                const isOverdue = task.deadline && task.deadline < today && !task.completed;
                return `
                <div class="flex items-start justify-between p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-100' : isOverdue ? 'bg-red-100/90 border-red-400 shadow-sm' : 'bg-white border-gray-100'}">
                    <div class="flex items-start gap-3 w-full max-w-[85%]">
                        <div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}">
                            ${task.completed ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                        </div>
                        <div class="flex-1">
                            <p class="font-medium ${task.completed ? 'text-gray-500 line-through text-sm' : 'text-gray-800 text-sm'}">${task.title}</p>
                            ${task.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">${task.description}</p>` : ''}
                            ${task.remark ? `<div class="mt-1.5 p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs flex gap-1.5"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i><span class="break-all"><strong>Issue:</strong> ${task.remark}</span></span></div>` : ''}
                            ${task.deadline ? `<div class="mt-1 p-1 bg-amber-50/50 rounded border border-amber-100 text-amber-700 text-[10px] flex gap-1 items-center max-w-max"><i class="fa-solid fa-hourglass-half text-[10px]"></i> <span><strong>Due:</strong> ${task.deadline}</span></div>` : ''}
                        </div>
                    </div>
                    <span class="text-[10px] text-gray-400 font-medium ml-4">${task.date}</span>
                </div>`;
            }).join('');
            html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group mb-6">
                <div class="bg-gray-50 px-6 py-4 flex justify-between items-center border-b border-gray-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-lg">
                            ${assignee === 'All Employees' ? '<i class="fa-solid fa-users"></i>' : assignee.charAt(0).toUpperCase()}
                        </div>
                        <div><h3 class="font-bold text-gray-800 text-lg">${assignee}</h3><p class="text-xs text-gray-500">${totalTasks} task${totalTasks !== 1 ? 's' : ''}</p></div>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-sm font-bold ${percent === 100 ? 'text-green-600' : 'text-slate-600'}">${percent}% Done</span>
                        <div class="w-24 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div class="h-full ${percent === 100 ? 'bg-green-500' : 'bg-slate-500'}" style="width:${percent}%"></div>
                        </div>
                    </div>
                </div>
                <div class="p-4 space-y-2">${taskListHtml}</div>
            </div>`;
        });
        managerAllTasksList.innerHTML = html;
    }

    // ---- Chat: Render Contact List ----
    function renderMgrChatList() {
        const chatContacts = [{ name: "Team Leader" }, ...employees];
        let mobileOptions = `<option value="">Select someone...</option>`;
        mgrChatContactList.innerHTML = chatContacts.map(contact => {
            mobileOptions += `<option value="${contact.name}">${contact.name}</option>`;
            const isActive = activeChatContact === contact.name;
            const conversation = messages.filter(m => (m.sender === contact.name && m.receiver === "Manager") || (m.sender === "Manager" && m.receiver === contact.name));
            const lastMsg = conversation.length > 0 ? conversation[conversation.length - 1].text : "No messages yet.";
            const unreadCount = messages.filter(m => m.sender === contact.name && m.receiver === "Manager" && !m.read).length;
            
            const isLeader = contact.name === "Team Leader";

            return `
            <div class="p-3 bg-white border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50 border-l-4 border-l-slate-600' : ''}" onclick="window.selectMgrChatContact('${contact.name}')">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-10 h-10 rounded-full ${isActive ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-bold">
                            ${isLeader ? '<i class="fa-solid fa-crown text-sm"></i>' : contact.name.charAt(0).toUpperCase()}
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
        mgrChatMobileSelect.innerHTML = mobileOptions;
        if (activeChatContact) mgrChatMobileSelect.value = activeChatContact;
    }

    window.selectMgrChatContact = function(name) {
        activeChatContact = name;
        if (mgrChatMobileSelect) mgrChatMobileSelect.value = name;
        mgrChatActiveAvatar.classList.remove("hidden");
        mgrChatActiveAvatar.textContent = name === "Team Leader" ? "L" : name.charAt(0).toUpperCase();
        mgrChatActiveName.textContent = name;
        mgrChatInput.disabled = false;
        mgrChatSend.disabled = false;
        mgrChatInput.classList.remove("bg-gray-100", "cursor-not-allowed");
        mgrChatInput.classList.add("bg-white");
        mgrChatSend.classList.remove("bg-gray-400", "cursor-not-allowed");
        mgrChatSend.classList.add("bg-slate-800", "hover:bg-slate-900");
        if (mgrChatClear) mgrChatClear.classList.remove("hidden");
        markMessagesRead(name, "Manager");
        renderMgrChatList();
        renderMgrChatMessages();
        setTimeout(() => mgrChatInput.focus(), 100);
    };

    mgrChatMobileSelect.addEventListener("change", (e) => { if (e.target.value) window.selectMgrChatContact(e.target.value); });

    function renderMgrChatMessages() {
        if (!activeChatContact) return;
        const conversation = messages.filter(m =>
            (m.sender === activeChatContact && m.receiver === "Manager") ||
            (m.sender === "Manager" && m.receiver === activeChatContact)
        );
        if (conversation.length === 0) {
            mgrChatMessages.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center p-6 opacity-60 m-auto"><i class="fa-regular fa-comments text-4xl mb-3 text-slate-300"></i><p class="text-gray-600 text-sm">No messages yet.</p></div>`;
            return;
        }
        mgrChatMessages.innerHTML = `<div class="space-y-4 pt-2 pb-2">
            ${conversation.map(msg => {
                const isMe = msg.sender === "Manager";
                return `<div class="flex w-full ${isMe ? 'justify-end' : 'justify-start'} group">
                    <div class="relative max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}">
                        <p>${msg.text}</p>
                        <div class="flex items-center justify-between mt-1 gap-2">
                            <button onclick="window.handleDeleteMessage('${msg.id}')" class="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-600 transition-all pr-1" title="Delete message">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <p class="text-[10px] ${isMe ? 'text-slate-300' : 'text-gray-400'} ml-auto">${msg.time}</p>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
        mgrChatMessages.scrollTop = mgrChatMessages.scrollHeight;
    }

    async function sendMgrMessage() {
        const text = mgrChatInput.value.trim();
        if (!text || !activeChatContact) return;
        mgrChatInput.value = "";
        await addMessage({
            sender:   "Manager",
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

    mgrChatSend.addEventListener("click", sendMgrMessage);
    mgrChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMgrMessage(); });

    function updateUnreadBadges() {
        const badge = document.getElementById("nav-badge-manager-chat");
        if (!badge) return;
        const unreadCount = messages.filter(m => m.receiver === "Manager" && !m.read).length;
        if (unreadCount > 0) { badge.textContent = unreadCount; badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
    }

    function renderClientsTable() {
        if (!managerClientsTableBody) return;
        if (clients.length === 0) {
            managerClientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">No clients found.</td></tr>`;
            return;
        }
        managerClientsTableBody.innerHTML = clients.map((client, index) => {
            const isActive = client.active !== false;
            return `
                <tr class="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 text-gray-500 font-medium">${index + 1}</td>
                    <td class="px-4 py-3 font-bold text-gray-800 max-w-[200px] break-words whitespace-normal">${client.name}</td>
                    <td class="px-4 py-3 text-gray-600 max-w-[150px] break-words whitespace-normal">${client.work || '-'}</td>
                    <td class="px-4 py-3 text-gray-600 font-medium">${client.phone || '-'}</td>
                    <td class="px-4 py-3">
                        <a href="${client.gmb}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1">
                            <i class="fa-solid fa-location-dot text-xs"></i> View GMB
                        </a>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-gray-600 font-medium">${client.reportDate}</td>
                </tr>
            `;
        }).join('');
    }

    // ---- Firestore Listeners ----
    unsubTasks = listenTasks((newTasks) => {
        tasks = newTasks;
        renderManagerTasks();
    });

    unsubEmployees = listenEmployees((newEmployees) => {
        employees = newEmployees;
        renderMgrChatList();
    });

    unsubMessages = listenMessages((newMessages) => {
        messages = newMessages;
        updateUnreadBadges();
        renderMgrChatList();
        renderMgrChatMessages();
    });

    unsubClients = listenAllClients((newClients) => {
        clients = newClients;
        if (typeof renderClientsTable === "function") renderClientsTable();
    });
});
