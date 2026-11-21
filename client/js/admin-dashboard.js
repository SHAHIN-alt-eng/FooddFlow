"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const API_BASE_URL = window.FOODFLOW_API_BASE_URL;
    const token = localStorage.getItem("foodflow_token");
    const storedUser = JSON.parse(localStorage.getItem("foodflow_user") || "null");
    const adminName = document.getElementById("adminName");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const avatarInitial = document.getElementById("avatarInitial");
    const adminMessage = document.getElementById("adminMessage");
    const mealList = document.getElementById("mealList");
    const mealForm = document.getElementById("createMealForm");
    const mealButton = document.getElementById("createMealButton");
    const formStatus = document.getElementById("formStatus");
    const mealHall = document.getElementById("mealHall");
    const toast = document.getElementById("toast");
    const overviewFields = {
        students: document.getElementById("studentTotal"),
        staff: document.getElementById("staffTotal"),
        published_meals: document.getElementById("publishedMealTotal"),
        total_reservations: document.getElementById("reservationTotal"),
        meal_remaining: document.getElementById("mealRemaining"),
        cancelled_reservations: document.getElementById("cancelledReservations"),
        collected_reservations: document.getElementById("collectedReservations")
    };
    const userList = document.getElementById("userList");
    const reservationList = document.getElementById("reservationList");
    const staffList = document.getElementById("staffList");
    const createStaffForm = document.getElementById("createStaffForm");
    const createStaffButton = document.getElementById("createStaffButton");
    const staffFormStatus = document.getElementById("staffFormStatus");
    const staffHall = document.getElementById("staffHall");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const HALLS = ["Shaheed President Zia Hall", "Abdul Hamid Hall", "Tinshed Hall", "Shohidul Hall", "Shere-e-Bangla A K Fazlul Haque Hall", "Selim Hall", "Male Hall-1", "Male Hall-2", "Male Hall-3", "Female Hall 1", "Female Hall 2"];

    function nextDayValue() {
        return FoodFlowDate.tomorrowDateKey();
    }

    HALLS.forEach((hall) => mealHall?.add(new Option(hall, hall)));
    HALLS.forEach((hall) => staffHall?.add(new Option(hall, hall)));

    function redirectToLogin() {
        localStorage.removeItem("foodflow_token");
        localStorage.removeItem("foodflow_user");
        window.location.href = "login.html";
    }

    function showToast(message, type = "success") {
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast toast-${type} toast-visible`;
        window.setTimeout(() => toast.classList.remove("toast-visible"), 2800);
    }

    async function apiRequest(path, options = {}) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
        if (response.status === 401) {
            redirectToLogin();
            return null;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
        return data;
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date unavailable";
        return new Intl.DateTimeFormat(undefined, {
            month: "short", day: "numeric", year: "numeric"
        }).format(date);
    }

    function setEmptyState(container, title, message, icon = "◫") {
        if (!container) return;
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${message}</p></div>`;
    }

    async function loadOverview() {
        const data = await apiRequest("/admin/overview");
        const overview = data?.overview || {};
        Object.entries(overviewFields).forEach(([key, element]) => {
            if (element) element.textContent = String(Number(overview[key]) || 0);
        });
    }

    function createUserActions(user) {
        // Admin accounts are protected - only students and staff can be deleted.
        if (!["student", "staff"].includes(user.role)) return null;

        const actions = document.createElement("div");
        actions.className = "admin-meal-actions";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "admin-row-button admin-row-button-danger";
        remove.textContent = "Delete";
        remove.setAttribute("aria-label", `Delete ${user.name || "user"}`);
        remove.addEventListener("click", () => deleteUser(user, remove));
        actions.append(remove);
        return actions;
    }

    function createUserRow(user, metaText, fallbackName) {
        const row = document.createElement("article");
        row.className = "admin-meal-row admin-user-row";
        const info = document.createElement("div");
        info.className = "admin-meal-info";
        const name = document.createElement("h3");
        name.textContent = user.name || fallbackName;
        const meta = document.createElement("p");
        meta.textContent = metaText;
        info.append(name, meta);
        const status = document.createElement("span");
        status.className = `admin-meal-status status-${user.status}`;
        status.textContent = user.status || "unknown";
        row.append(info, status);
        const actions = createUserActions(user);
        if (actions) row.append(actions);
        return row;
    }

    function renderUsers(users) {
        if (!userList) return;
        if (!users.length) {
            setEmptyState(userList, "No users found", "Try changing the search or account filters.");
            return;
        }
        userList.replaceChildren(...users.map((user) =>
            createUserRow(user, `#${user.id} · ${user.email} · ${formatType(user.role)}`, "Unnamed user")
        ));
    }

    async function loadUsers() {
        const params = new URLSearchParams({
            search: document.getElementById("userSearch")?.value.trim() || "",
            role: document.getElementById("userRoleFilter")?.value || "all",
            status: document.getElementById("userStatusFilter")?.value || "all"
        });
        const data = await apiRequest(`/admin/users?${params}`);
        renderUsers(Array.isArray(data?.users) ? data.users : []);
    }

    async function loadStaff() {
        const params = new URLSearchParams({ role: "staff", status: "all", search: "" });
        const data = await apiRequest(`/admin/users?${params}`);
        const staff = Array.isArray(data?.users) ? data.users : [];

        if (!staffList) return;
        if (!staff.length) {
            setEmptyState(staffList, "No staff accounts yet", "Use the form above to create the first staff account.");
            return;
        }
        staffList.replaceChildren(...staff.map((user) =>
            createUserRow(user, `#${user.id} · ${user.email} · ${user.hall_name || "No hall assigned"}`, "Unnamed staff")
        ));
    }

    /* ---------- Delete student / staff account ---------- */

    function showDeleteUserModal(user) {
        return new Promise((resolve) => {
            const modal = document.getElementById("deleteUserModal");
            const cancelBtn = modal.querySelector(".modal-button-cancel");
            const confirmBtn = modal.querySelector(".modal-button-confirm");
            const closeBtn = modal.querySelector(".modal-close");
            const isStaff = user.role === "staff";

            document.getElementById("deleteUserRole").textContent = isStaff ? "staff" : "student";
            document.getElementById("deleteUserName").textContent = user.name || "Unnamed user";
            document.getElementById("deleteUserEmail").textContent = user.email || "";
            document.getElementById("deleteUserWarning").textContent = isStaff
                ? "This permanently removes the staff account. Past meal-collection records are kept. This cannot be undone."
                : "This permanently removes the student account together with their reservations and complaints. This cannot be undone.";

            function cleanup() {
                modal.style.display = "none";
                cancelBtn.removeEventListener("click", onCancel);
                confirmBtn.removeEventListener("click", onConfirm);
                closeBtn.removeEventListener("click", onCancel);
                modal.removeEventListener("click", onBackdropClick);
                document.removeEventListener("keydown", onKeyDown);
            }

            function onCancel() { cleanup(); resolve(false); }
            function onConfirm() { cleanup(); resolve(true); }
            function onBackdropClick(e) { if (e.target === modal) onCancel(); }
            function onKeyDown(e) { if (e.key === "Escape") onCancel(); }

            modal.style.display = "flex";
            cancelBtn.addEventListener("click", onCancel);
            confirmBtn.addEventListener("click", onConfirm);
            closeBtn.addEventListener("click", onCancel);
            modal.addEventListener("click", onBackdropClick);
            document.addEventListener("keydown", onKeyDown);
            cancelBtn.focus();
        });
    }

    async function deleteUser(user, button) {
        const confirmed = await showDeleteUserModal(user);
        if (!confirmed) return;

        button.disabled = true;
        try {
            const data = await apiRequest(`/admin/users/${user.id}`, { method: "DELETE" });
            showToast(data?.message || "Account deleted successfully.");
            // Reservations, seat counts and totals may all have changed.
            await Promise.all([loadUsers(), loadStaff(), loadOverview(), loadReservations(), loadMeals()]);
        } catch (error) {
            showToast(error.message, "error");
            button.disabled = false;
        }
    }

    function reservationStatusLabel(status) {
        return {
            pending_payment: "Payment pending",
            reserved: "Booked",
            cancelled: "Cancelled",
            collected: "Completed",
            completed: "Completed"
        }[status] || status || "Unknown";
    }

    function renderReservations(reservations) {
        if (!reservationList) return;
        if (!reservations.length) {
            setEmptyState(reservationList, "No reservations found", "Try changing the search or reservation filters.", "▣");
            return;
        }
        reservationList.replaceChildren(...reservations.map((reservation) => {
            const row = document.createElement("article");
            row.className = "admin-meal-row";
            const info = document.createElement("div");
            info.className = "admin-meal-info";
            const title = document.createElement("h3");
            title.textContent = reservation.student_name || "Unknown student";
            const meta = document.createElement("p");
            const collectionText = reservation.collected_at
                ? ` · Collected ${formatDate(reservation.collected_at)}${reservation.collection_staff_id ? ` by staff #${reservation.collection_staff_id}` : ""}`
                : "";
            meta.textContent = `${reservation.menu_name || "Meal"} · ${formatType(reservation.meal_type)} · ${formatDate(reservation.meal_date)}${collectionText}`;
            info.append(title, meta);
            const status = document.createElement("span");
            status.className = `admin-meal-status status-${reservation.status}`;
            status.textContent = reservationStatusLabel(reservation.status);
            row.append(info, status);
            return row;
        }));
    }

    async function loadReservations() {
        const statusMap = {
            booked: "reserved",
            completed: "collected"
        };
        const selectedStatus = document.getElementById("reservationStatusFilter")?.value || "all";
        const params = new URLSearchParams({
            search: document.getElementById("reservationSearch")?.value.trim() || "",
            meal_type: document.getElementById("reservationMealFilter")?.value || "all",
            status: statusMap[selectedStatus] || selectedStatus
        });
        const data = await apiRequest(`/admin/reservations?${params}`);
        renderReservations(Array.isArray(data?.reservations) ? data.reservations : []);
    }

    function displayUser(user) {
        const name = user.name || "Admin";
        adminName.textContent = name;
        profileName.textContent = name;
        profileRole.textContent = user.role || "admin";
        avatarInitial.textContent = name.trim().charAt(0).toUpperCase() || "A";
    }

    function formatType(type) {
        const value = typeof type === "string" ? type.trim() : "";
        return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Meal";
    }

    function renderMeals(meals) {
        if (!meals.length) {
            mealList.innerHTML = `<div class="empty-state"><div class="empty-icon">◫</div><h3>No meals published for this date</h3><p>Publish a meal below to make it available to students.</p></div>`;
            return;
        }
        mealList.replaceChildren(...meals.map((meal) => {
            const row = document.createElement("article");
            row.className = "admin-meal-row";
            const info = document.createElement("div");
            info.className = "admin-meal-info";
            const title = document.createElement("h3");
            title.textContent = meal.menu_name || "Untitled meal";
            const meta = document.createElement("p");
            const availableSeats = Math.max(0, Number(meal.capacity || 0) - Number(meal.reserved_count || 0));
            meta.textContent = `${meal.hall_name || "Hall not assigned"} · ${formatType(meal.meal_type)} · ৳${Number(meal.price || 0).toFixed(2)} · ${availableSeats} seats remaining (${meal.reserved_count || 0} reserved of ${meal.capacity || 0})`;
            info.append(title, meta);
            const status = document.createElement("span");
            status.className = `admin-meal-status status-${meal.status || "available"}`;
            status.textContent = meal.status || "available";
            const actions = document.createElement("div");
            actions.className = "admin-meal-actions";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "admin-row-button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => fillForm(meal));
            const close = document.createElement("button");
            close.type = "button";
            close.className = "admin-row-button admin-row-button-danger";
            close.textContent = "Close";
            close.addEventListener("click", () => closeMeal(meal.id));
            actions.append(edit, close);
            row.append(info, status, actions);
            return row;
        }));
    }

    function fillForm(meal) {
        mealForm.dataset.editingId = meal.id;
        document.getElementById("mealDate").value = String(meal.meal_date).slice(0, 10);
        document.getElementById("mealType").value = meal.meal_type || "lunch";
        mealHall.value = meal.hall_name || "";
        document.getElementById("menuName").value = meal.menu_name || "";
        document.getElementById("description").value = meal.description || "";
        document.getElementById("capacity").value = meal.capacity ?? "";
        document.getElementById("mealPrice").value = meal.price ?? "";
        document.getElementById("reservationDeadline").value = meal.reservation_deadline ? new Date(meal.reservation_deadline).toISOString().slice(0, 16) : "";
        mealButton.innerHTML = "Save changes <span aria-hidden=\"true\">→</span>";
        formStatus.textContent = `Editing ${meal.menu_name || "meal"}.`;
        formStatus.className = "form-status form-status-info";
        mealForm.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function resetForm() {
        mealForm.reset();
        delete mealForm.dataset.editingId;
        document.getElementById("mealDate").value = nextDayValue();
        mealButton.innerHTML = "Publish meal <span aria-hidden=\"true\">→</span>";
    }

    async function closeMeal(mealId) {
        if (!window.confirm("Are you sure you want to close this meal?")) return;
        try {
            await apiRequest(`/meals/${mealId}`, { method: "DELETE" });
            showToast("Meal closed successfully.");
            await Promise.all([loadMeals(), loadOverview()]);
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    async function loadMeals() {
        const date = document.getElementById("mealDate").value || FoodFlowDate.dateKey();
        const data = await apiRequest(`/meals?date=${encodeURIComponent(date)}`);
        renderMeals(Array.isArray(data?.meals) ? data.meals : []);
    }

    mealForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        mealButton.disabled = true;
        formStatus.textContent = "Saving meal...";
        const body = Object.fromEntries(new FormData(mealForm).entries());
        body.capacity = Number(body.capacity);
        body.price = Number(body.price);
        if (!body.description) body.description = null;
        if (!body.reservation_deadline) body.reservation_deadline = null;
        try {
            const id = mealForm.dataset.editingId;
            await apiRequest(id ? `/meals/${id}` : "/meals", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
            resetForm();
            formStatus.textContent = "Saved. The meal schedule is up to date.";
            formStatus.className = "form-status form-status-success";
            showToast(id ? "Meal updated successfully." : "Meal published successfully.");
            await loadMeals();
        } catch (error) {
            formStatus.textContent = error.message;
            formStatus.className = "form-status form-status-error";
            showToast(error.message, "error");
        } finally {
            mealButton.disabled = false;
        }
    });

    document.getElementById("refreshMealsButton").addEventListener("click", async () => {
        try { await Promise.all([loadMeals(), loadOverview()]); showToast("Schedule refreshed."); } catch (error) { showToast(error.message, "error"); }
    });

    document.getElementById("refreshUsersButton").addEventListener("click", async () => {
        try { await loadUsers(); showToast("Users refreshed."); } catch (error) { showToast(error.message, "error"); }
    });

    document.getElementById("refreshStaffButton").addEventListener("click", async () => {
        try { await loadStaff(); showToast("Staff list refreshed."); } catch (error) { showToast(error.message, "error"); }
    });

    createStaffForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        createStaffButton.disabled = true;
        staffFormStatus.textContent = "Creating staff account...";
        staffFormStatus.className = "form-status";

        const formData = new FormData(createStaffForm);
        const body = Object.fromEntries(formData.entries());

        try {
            await apiRequest("/admin/staff", {
                method: "POST",
                body: JSON.stringify(body)
            });
            showToast("Staff account created successfully.");
            staffFormStatus.textContent = `Staff account created for ${body.email}.`;
            staffFormStatus.className = "form-status form-status-success";
            createStaffForm.reset();
            await loadStaff();
            await loadOverview();
        } catch (error) {
            staffFormStatus.textContent = error.message;
            staffFormStatus.className = "form-status form-status-error";
            showToast(error.message, "error");
        } finally {
            createStaffButton.disabled = false;
        }
    });

    document.getElementById("refreshReservationsButton").addEventListener("click", async () => {
        try { await loadReservations(); showToast("Reservations refreshed."); } catch (error) { showToast(error.message, "error"); }
    });

    ["userSearch", "userRoleFilter", "userStatusFilter"].forEach((id) => {
        document.getElementById(id).addEventListener("input", loadUsers);
        document.getElementById(id).addEventListener("change", loadUsers);
    });

    ["reservationSearch", "reservationMealFilter", "reservationStatusFilter"].forEach((id) => {
        document.getElementById(id).addEventListener("input", loadReservations);
        document.getElementById(id).addEventListener("change", loadReservations);
    });

    /* =====================================================
       Custom Modal Handler
       ===================================================== */

    function showLogoutModal() {
        return new Promise((resolve) => {
            const modal = document.getElementById("logoutModal");
            const cancelBtn = modal.querySelector(".modal-button-cancel");
            const confirmBtn = modal.querySelector(".modal-button-confirm");
            const closeBtn = modal.querySelector(".modal-close");

            function cleanup() {
                modal.style.display = "none";
                cancelBtn.removeEventListener("click", onCancel);
                confirmBtn.removeEventListener("click", onConfirm);
                closeBtn.removeEventListener("click", onCancel);
                modal.removeEventListener("click", onBackdropClick);
            }

            function onCancel() {
                cleanup();
                resolve(false);
            }

            function onConfirm() {
                cleanup();
                resolve(true);
            }

            function onBackdropClick(e) {
                if (e.target === modal) {
                    onCancel();
                }
            }

            modal.style.display = "flex";
            cancelBtn.addEventListener("click", onCancel);
            confirmBtn.addEventListener("click", onConfirm);
            closeBtn.addEventListener("click", onCancel);
            modal.addEventListener("click", onBackdropClick);
            confirmBtn.focus();
        });
    }

    document.getElementById("logoutButton").addEventListener("click", async () => {
        const confirmed = await showLogoutModal();
        if (!confirmed) return;

        localStorage.removeItem("foodflow_token");
        localStorage.removeItem("foodflow_user");
        window.location.href = "login.html";
    });

    /* =====================================================
       Complaints - Student Feedback (all halls)
    ===================================================== */

    const complaintList = document.getElementById("complaintList");
    const refreshComplaintsButton = document.getElementById("refreshComplaintsButton");
    const complaintStatusFilter = document.getElementById("complaintStatusFilter");

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function formatComplaintDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(undefined, {
            month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
        }).format(date);
    }

    function formatComplaintStatus(status) {
        const map = { pending: "Pending", in_progress: "In progress", resolved: "Resolved" };
        return map[status] || status;
    }

    function renderComplaints(complaints) {
        if (!complaintList) return;

        if (!complaints.length) {
            complaintList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>No complaints</h3><p>No student complaints match this filter.</p></div>`;
            return;
        }

        complaintList.innerHTML = complaints.map((complaint) => `
            <article class="complaint-item" data-complaint-id="${complaint.id}">
                <div class="complaint-item-header">
                    <div>
                        <h3>${escapeHtml(complaint.subject)}</h3>
                        <div class="complaint-item-meta">${escapeHtml(complaint.student_name || "Unknown student")} · ${escapeHtml(complaint.hall_name || "")} · ${formatComplaintDate(complaint.created_at)}</div>
                    </div>
                    <span class="complaint-status status-${complaint.status}">${formatComplaintStatus(complaint.status)}</span>
                </div>
                <p class="complaint-message">${escapeHtml(complaint.message)}</p>
                ${complaint.staff_response ? `<div class="complaint-response"><strong>Response:</strong> ${escapeHtml(complaint.staff_response)}</div>` : ""}
                <div class="complaint-manage-actions">
                    <select class="complaint-status-select">
                        <option value="pending" ${complaint.status === "pending" ? "selected" : ""}>Pending</option>
                        <option value="in_progress" ${complaint.status === "in_progress" ? "selected" : ""}>In progress</option>
                        <option value="resolved" ${complaint.status === "resolved" ? "selected" : ""}>Resolved</option>
                    </select>
                    <textarea class="complaint-response-input" rows="1" placeholder="Write a response (optional)">${escapeHtml(complaint.staff_response || "")}</textarea>
                    <button type="button" class="complaint-save-button">Save</button>
                </div>
            </article>
        `).join("");
    }

    async function loadComplaints() {
        if (!complaintList) return;

        try {
            const status = complaintStatusFilter?.value || "all";
            const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
            const data = await apiRequest(`/complaints${query}`);
            renderComplaints(Array.isArray(data?.complaints) ? data.complaints : []);
        } catch (error) {
            complaintList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>Could not load complaints</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
    }

    if (complaintList) {
        complaintList.addEventListener("click", async (event) => {
            const saveButton = event.target.closest(".complaint-save-button");
            if (!saveButton) return;

            const item = saveButton.closest(".complaint-item");
            const complaintId = item?.dataset.complaintId;
            if (!complaintId) return;

            const status = item.querySelector(".complaint-status-select").value;
            const staff_response = item.querySelector(".complaint-response-input").value.trim();

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";

            try {
                await apiRequest(`/complaints/${complaintId}`, {
                    method: "PUT",
                    body: JSON.stringify({ status, staff_response: staff_response || null })
                });
                showToast("Complaint updated.");
                await loadComplaints();
            } catch (error) {
                showToast(error.message, "error");
                saveButton.disabled = false;
                saveButton.textContent = "Save";
            }
        });
    }

    if (refreshComplaintsButton) {
        refreshComplaintsButton.addEventListener("click", async () => {
            try { await loadComplaints(); showToast("Complaints refreshed."); } catch (error) { showToast(error.message, "error"); }
        });
    }

    if (complaintStatusFilter) {
        complaintStatusFilter.addEventListener("change", async () => {
            try { await loadComplaints(); } catch (error) { showToast(error.message, "error"); }
        });
    }

    /* =====================================================
       Overview cards -> one section at a time
       ===================================================== */

    // "publish-meal" lives inside the Meal Management view.
    const VIEW_ALIASES = { "publish-meal": "meal-operations" };
    const viewSections = document.querySelectorAll("[data-view]");
    const backBar = document.getElementById("adminBackBar");
    const navItems = document.querySelectorAll(".dashboard-nav .nav-item");

    function showView() {
        const requested = window.location.hash.replace("#", "") || "overview";
        const requestedView = VIEW_ALIASES[requested] || requested;
        const isKnown = Array.from(viewSections).some((section) => section.dataset.view === requestedView);
        const view = isKnown ? requestedView : "overview";

        viewSections.forEach((section) => { section.hidden = section.dataset.view !== view; });
        if (backBar) backBar.hidden = view === "overview";

        // Back on the overview: clear any filter a card applied.
        if (view === "overview") {
            ["userRoleFilter", "reservationStatusFilter"].forEach((id) => {
                const select = document.getElementById(id);
                if (select && select.value !== "all") {
                    select.value = "all";
                    select.dispatchEvent(new Event("change"));
                }
            });
        }

        const activeHref = `#${isKnown ? requested : "overview"}`;
        navItems.forEach((item) => item.classList.toggle("active", item.getAttribute("href") === activeHref));

        const anchor = isKnown && requested !== view ? document.getElementById(requested) : null;
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0 });
    }

    function openCard(card) {
        const filter = card.dataset.filter;
        if (filter) {
            const [selectId, value] = filter.split("=");
            const select = document.getElementById(selectId);
            if (select) {
                select.value = value;
                select.dispatchEvent(new Event("change"));
            }
        }
        window.location.hash = card.dataset.target;
    }

    document.querySelectorAll(".admin-stat-card[data-target]").forEach((card) => {
        card.addEventListener("click", () => openCard(card));
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard(card);
            }
        });
    });

    window.addEventListener("hashchange", showView);
    showView();

    try {
        document.getElementById("mealDate").min = nextDayValue();
        document.getElementById("mealDate").value = nextDayValue();
        const profile = await apiRequest("/auth/profile");
        const user = profile?.user || storedUser;
        if (!user || !["admin"].includes(user.role)) {
            window.location.href = user?.role === "staff" ? "staff-dashboard.html" : "login.html";
            return;
        }
        displayUser(user);
        await loadMeals();
        await Promise.all([loadOverview(), loadUsers(), loadReservations(), loadStaff()]);
        adminMessage.textContent = "Your admin workspace is securely connected.";
        adminMessage.classList.add("message-success");
    } catch (error) {
        adminMessage.textContent = error.message || "Unable to load the admin workspace.";
        adminMessage.classList.add("message-error");
    }
});
