// Firebase Setup — configuration comes from env.js
import { firebaseConfig } from "./env.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// =====================
// INIT
// =====================
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// =====================
// AUTHENTICATION
// =====================

/**
 * Login with email & password (Firebase Auth)
 * Returns the user object on success, throws on failure
 */
export async function loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
}

/**
 * Logout current Firebase user
 */
export async function logoutFirebase() {
    await signOut(auth);
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// =====================
// TASKS
// =====================
export async function getTasks() {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function listenTasks(callback) {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(tasks);
    });
}

export async function addTask(task) {
    const docRef = await addDoc(collection(db, "tasks"), {
        ...task,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

export async function updateTask(taskId, updates) {
    await updateDoc(doc(db, "tasks", taskId), updates);
}

export async function deleteTask(taskId) {
    await deleteDoc(doc(db, "tasks", taskId));
}

// =====================
// EMPLOYEES
// =====================
export async function getEmployees() {
    const snapshot = await getDocs(collection(db, "employees"));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function listenEmployees(callback) {
    return onSnapshot(collection(db, "employees"), (snapshot) => {
        const employees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(employees);
    });
}

export async function addEmployee(emp) {
    const docRef = await addDoc(collection(db, "employees"), emp);
    return docRef.id;
}

export async function updateEmployee(empId, data) {
    await updateDoc(doc(db, "employees", empId), data);
}

export async function deleteEmployee(empId) {
    await deleteDoc(doc(db, "employees", empId));
}

// =====================
// MESSAGES
// =====================
export function listenMessages(callback) {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(messages);
    });
}

export async function addMessage(msg) {
    await addDoc(collection(db, "messages"), {
        ...msg,
        read: false,
        createdAt: serverTimestamp()
    });
}

export async function markMessagesRead(sender, receiver) {
    const q = query(
        collection(db, "messages"),
        where("sender", "==", sender),
        where("receiver", "==", receiver),
        where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map(d => updateDoc(doc(db, "messages", d.id), { read: true }));
    await Promise.all(updates);
}

// =====================
// CLIENTS
// =====================
export function listenClients(employeeName, callback) {
    const q = query(
        collection(db, "clients"),
        where("employeeName", "==", employeeName)
    );
    return onSnapshot(q, (snapshot) => {
        const clients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort in memory to avoid needing a Firestore composite index
        clients.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tA - tB;
        });
        callback(clients);
    });
}

export function listenAllClients(callback) {
    const q = query(collection(db, "clients"));
    return onSnapshot(q, (snapshot) => {
        const clients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        clients.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tA - tB;
        });
        callback(clients);
    });
}

export async function addClient(client) {
    const docRef = await addDoc(collection(db, "clients"), {
        ...client,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

export async function updateClient(clientId, updates) {
    await updateDoc(doc(db, "clients", clientId), updates);
}

export async function deleteClient(clientId) {
    await deleteDoc(doc(db, "clients", clientId));
}

export async function deleteMessage(messageId) {
    try {
        const docRef = doc(db, "messages", messageId);
        await deleteDoc(docRef);
        alert("Firestore Delete Doc SUCCESS resolved for ID: " + messageId);
    } catch (err) {
        alert("Firestore Delete Doc ERROR: " + err.message);
    }
}

export async function clearChat(user1, user2) {
    const q1 = query(collection(db, "messages"), where("sender", "==", user1), where("receiver", "==", user2));
    const q2 = query(collection(db, "messages"), where("sender", "==", user2), where("receiver", "==", user1));
    
    const snap1 = await getDocs(q1);
    const snap2 = await getDocs(q2);
    
    const batch = writeBatch(db);
    snap1.forEach(d => batch.delete(d.ref));
    snap2.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

export { db, auth };

