"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const API_BASE_URL = window.FOODFLOW_API_BASE_URL;
    const token = localStorage.getItem("foodflow_token");
    const storedUser = JSON.parse(localStorage.getItem("foodflow_user") || "null");

    const staffName = document.getElementById("staffName");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const avatarInitial = document.getElementById("avatarInitial");
    const staffMessage = document.getElementById("staffMessage");
    const mealList = document.getElementById("mealList");
    const mealTotal = document.getElementById("mealTotal");
    const availableSeats = document.getElementById("availableSeats");
    const serviceStatus = document.getElementById("serviceStatus");
    const serviceStatusHint = document.getElementById("serviceStatusHint");
    const todayDate = document.getElementById("todayDate");

    function nextDayValue() {
        return FoodFlowDate.tomorrowDateKey();
    }
    const createMealForm = document.getElementById("createMealForm");
    const createMealButton = document.getElementById("createMealButton");
    const formStatus = document.getElementById("formStatus");
    const toast = document.getElementById("toast");
    const paymentList = document.getElementById("paymentList");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const showToast = (message, type = "success") => {
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast toast-${type} toast-visible`;
        window.setTimeout(() => toast.classList.remove("toast-visible"), 2800);
    };

    const redirectToLogin = () => {
        localStorage.removeItem("foodflow_token");
        localStorage.removeItem("foodflow_user");
        window.location.href = "login.html";
    };

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
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Request failed.");
        }
        return data;
    }

    function displayUser(user) {
        const theme = user.hall_name ? user.hall_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "default";
        document.body.dataset.hallTheme = theme;
        const name = user.name || "Staff";
        const role = user.role || "staff";
        const initial = name.trim().charAt(0).toUpperCase() || "S";

        staffName.textContent = name;
        profileName.textContent = name;
        profileRole.textContent = role;
        avatarInitial.textContent = initial;
    }

    function formatMealType(value) {
        const type = typeof value === "string" ? value.trim() : "";
        return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Meal";
    }

    function formatDeadline(value) {
        if (!value) return "No deadline set";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Deadline unavailable";
        return `Until ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
    }

    function renderMeals(meals) {
        mealTotal.textContent = String(meals.length);
        availableSeats.textContent = String(meals.reduce((total, meal) => {
            const capacity = Number(meal.capacity) || 0;
            const reserved = Number(meal.reserved_count) || 0;
            return total + Math.max(0, capacity - reserved);
        }, 0));

        if (!meals.length) {
            mealList.innerHTML = `<div class="empty-state"><div class="empty-icon">◫</div><h3>No meals published today</h3><p>Use the form below to publish the first meal for today.</p></div>`;
            serviceStatus.textContent = "Pending";
            serviceStatusHint.textContent = "Publish a meal to begin service";
            return;
        }

        serviceStatus.textContent = "Live";
        serviceStatusHint.textContent = `${meals.length} meal${meals.length === 1 ? "" : "s"} available to students`;
        mealList.replaceChildren(...meals.map((meal) => {
            const item = document.createElement("article");
            item.className = "staff-meal-row";

            const identity = document.createElement("div");
            identity.className = "staff-meal-identity";
            const title = document.createElement("h3");
            title.textContent = meal.menu_name || "Untitled meal";
            const meta = document.createElement("p");
            meta.textContent = `${formatMealType(meal.meal_type)} · ৳${Number(meal.price || 0).toFixed(2)} · ${formatDeadline(meal.reservation_deadline)}`;
            identity.append(title, meta);

            const capacity = document.createElement("div");
            capacity.className = "staff-meal-capacity";
            const remaining = Math.max(0, (Number(meal.capacity) || 0) - (Number(meal.reserved_count) || 0));
            capacity.innerHTML = `<strong>${remaining}</strong><span>seats left</span>`;

            const actions = document.createElement("div");
            actions.className = "staff-meal-actions";
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "staff-row-button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => startEditMeal(meal));
            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "staff-row-button staff-row-button-danger";
            cancelButton.textContent = "Close";
            cancelButton.addEventListener("click", () => closeMeal(meal.id));
            actions.append(editButton, cancelButton);

            item.append(identity, capacity, actions);
            return item;
        }));
    }

    function setFormValues(meal) {
        createMealForm.dataset.editingId = meal.id;
        document.getElementById("mealDate").value = String(meal.meal_date).slice(0, 10);
        document.getElementById("mealType").value = meal.meal_type || "lunch";
        document.getElementById("menuName").value = meal.menu_name || "";
        document.getElementById("description").value = meal.description || "";
        document.getElementById("capacity").value = meal.capacity ?? "";
        document.getElementById("mealPrice").value = meal.price ?? "";
        document.getElementById("reservationDeadline").value = meal.reservation_deadline
            ? new Date(meal.reservation_deadline).toISOString().slice(0, 16)
            : "";
        createMealButton.innerHTML = "Save changes <span aria-hidden=\"true\">→</span>";
        createMealForm.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function startEditMeal(meal) {
        setFormValues(meal);
        formStatus.textContent = `Editing ${meal.menu_name || "meal"}.`;
        formStatus.className = "form-status form-status-info";
    }

    async function closeMeal(mealId) {
        if (!window.confirm("Are you sure you want to close this meal?")) return;
        try {
            await apiRequest(`/meals/${mealId}`, { method: "DELETE" });
            showToast("Meal closed successfully.");
            await loadMeals();
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    function resetForm() {
        // Keep whatever date staff had selected (could be a future date)
        // so the menu list they see right after publishing doesn't
        // silently jump back to today's date.
        const selectedDate = document.getElementById("mealDate").value;
        createMealForm.reset();
        delete createMealForm.dataset.editingId;
        document.getElementById("mealDate").value = selectedDate || nextDayValue();
        createMealButton.innerHTML = "Publish meal <span aria-hidden=\"true\">→</span>";
    }

    async function loadProfile() {
        try {
            const data = await apiRequest("/auth/profile");
            if (data?.user) {
                if (data.user.role !== "staff" && data.user.role !== "admin") {
                    window.location.href = "student-dashboard.html";
                    return;
                }
                displayUser(data.user);
                localStorage.setItem("foodflow_user", JSON.stringify(data.user));
            }
        } catch (error) {
            if (storedUser?.role === "staff" || storedUser?.role === "admin") displayUser(storedUser);
            else throw error;
        }
    }

    async function loadMeals() {
        const date = document.getElementById("mealDate").value || nextDayValue();
        const data = await apiRequest(`/meals?date=${encodeURIComponent(date)}`);
        renderMeals(Array.isArray(data?.meals) ? data.meals : []);
    }

    function renderPayments(payments) {
        if (!paymentList) return;
        if (!payments.length) {
            paymentList.innerHTML = `<div class="empty-state"><div class="empty-icon">৳</div><h3>No payments received yet</h3><p>Completed student bKash payments for your published meals will appear here.</p></div>`;
            return;
        }
        paymentList.replaceChildren(...payments.map((payment) => {
            const item = document.createElement("article");
            item.className = "staff-meal-row";
            const identity = document.createElement("div");
            identity.className = "staff-meal-identity";
            const title = document.createElement("h3");
            title.textContent = payment.menu_name || "Meal payment";
            const details = document.createElement("p");
            details.textContent = `${payment.student_name || "Student"} · ${payment.merchant_invoice_number || ""}`;
            identity.append(title, details);
            const amount = document.createElement("div");
            amount.className = "staff-meal-capacity";
            const value = document.createElement("strong");
            value.textContent = `৳${Number(payment.amount || 0).toFixed(2)}`;
            const paymentStatus = document.createElement("span");
            paymentStatus.textContent = payment.refund_status === "pending"
                ? "Refund pending"
                : payment.status || "unknown";
            amount.append(value, paymentStatus);
            item.append(identity, amount);
            return item;
        }));
    }

    async function loadPayments() {
        if (!paymentList) return;
        try {
            const data = await apiRequest("/payments/received");
            renderPayments(Array.isArray(data?.payments) ? data.payments : []);
        } catch (error) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            const icon = document.createElement("div");
            icon.className = "empty-icon";
            icon.textContent = "!";
            const title = document.createElement("h3");
            title.textContent = "Could not load payments";
            const message = document.createElement("p");
            message.textContent = error.message;
            empty.append(icon, title, message);
            paymentList.replaceChildren(empty);
        }
    }

    createMealForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        createMealButton.disabled = true;
        formStatus.textContent = "Saving meal...";
        formStatus.className = "form-status";

        const formData = new FormData(createMealForm);
        const body = Object.fromEntries(formData.entries());
        body.capacity = Number(body.capacity);
        body.price = Number(body.price);
        if (!body.description) body.description = null;
        if (!body.reservation_deadline) body.reservation_deadline = null;

        try {
            const editingId = createMealForm.dataset.editingId;
            await apiRequest(editingId ? `/meals/${editingId}` : "/meals", {
                method: editingId ? "PUT" : "POST",
                body: JSON.stringify(body)
            });
            showToast(editingId ? "Meal updated successfully." : "Meal published successfully.");
            formStatus.textContent = "Saved. The student menu is now up to date.";
            formStatus.className = "form-status form-status-success";
            resetForm();
            await loadMeals();
        } catch (error) {
            formStatus.textContent = error.message;
            formStatus.className = "form-status form-status-error";
            showToast(error.message, "error");
        } finally {
            createMealButton.disabled = false;
        }
    });

    document.getElementById("refreshMealsButton").addEventListener("click", async () => {
        try {
            await loadMeals();
            showToast("Menu refreshed.");
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    document.getElementById("refreshPaymentsButton")?.addEventListener("click", loadPayments);

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
       QR SCANNER - Meal Collection
    ===================================================== */

    let html5QrCodeScanner = null;
    let currentScannedData = null;

    const startScannerButton = document.getElementById("startScannerButton");
    const stopScannerButton = document.getElementById("stopScannerButton");
    const qrScannerContainer = document.getElementById("qrScannerContainer");
    const scannerStatus = document.getElementById("scannerStatus");
    const scanResults = document.getElementById("scanResults");
    const scanResultMessage = document.getElementById("scanResultMessage");
    const confirmCollectionButton = document.getElementById("confirmCollectionButton");
    const dismissResultButton = document.getElementById("dismissResultButton");

    function initQRScanner() {
        if (html5QrCodeScanner) return;

        html5QrCodeScanner = new Html5Qrcode("qr-reader");
    }

    function parseQRToken(scannedText) {
        // QR contains: UUID token
        // Extract it directly
        return scannedText.trim();
    }

    async function handleScan(qrToken) {
        if (!qrToken || currentScannedData) return;

        currentScannedData = qrToken;
        scannerStatus.style.display = "none";

        try {
            // Call collect meal API with token
            const data = await apiRequest("/reservations/collect", {
                method: "POST",
                body: JSON.stringify({ qr_token: qrToken })
            });

            if (data?.success && data.reservation) {
                const res = data.reservation;
                document.getElementById("scannedReservationId").textContent = `#${res.id}`;
                document.getElementById("scannedStudentName").textContent = res.student_name || "Unknown";
                document.getElementById("scannedMealName").textContent = res.menu_name || "Unknown";
                document.getElementById("scannedHallName").textContent = res.hall_name || "Unknown";
                document.getElementById("scannedStatus").textContent = "Collected ✓";
                document.getElementById("scannedStatus").style.background = "#e8ebe8";
                document.getElementById("scannedStatus").style.color = "#4d6b47";

                scanResultMessage.textContent = "✓ Meal collected successfully!";
                scanResultMessage.className = "form-status form-status-success";
                scanResults.style.display = "block";

                confirmCollectionButton.style.display = "none";
            }
        } catch (error) {
            scanResultMessage.textContent = `Error: ${error.message}`;
            scanResultMessage.className = "form-status form-status-error";
            scanResults.style.display = "block";
        }
    }

    function resetScanResults() {
        currentScannedData = null;
        scanResults.style.display = "none";
        scannerStatus.style.display = "block";
        scannerStatus.textContent = "Scanning...";
        document.getElementById("scannedReservationId").textContent = "-";
        document.getElementById("scannedStudentName").textContent = "-";
        document.getElementById("scannedMealName").textContent = "-";
        document.getElementById("scannedHallName").textContent = "-";
        document.getElementById("scannedStatus").textContent = "Reserved";
        document.getElementById("scannedStatus").style.background = "#e8f0d4";
        document.getElementById("scannedStatus").style.color = "#527044";
        confirmCollectionButton.style.display = "block";
        scanResultMessage.textContent = "";
    }

    startScannerButton.addEventListener("click", async () => {
        initQRScanner();
        qrScannerContainer.style.display = "block";
        scannerStatus.style.display = "block";
        scanResults.style.display = "none";
        startScannerButton.style.display = "none";
        stopScannerButton.style.display = "block";
        resetScanResults();

        try {
            await html5QrCodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    handleScan(parseQRToken(decodedText));
                },
                (error) => {
                    // Ignore scanning errors
                }
            );
        } catch (error) {
            scannerStatus.textContent = "⚠ Camera access denied. Check permissions.";
            scannerStatus.style.background = "#f7e5df";
            scannerStatus.style.color = "#b25948";
        }
    });

    stopScannerButton.addEventListener("click", async () => {
        if (html5QrCodeScanner) {
            await html5QrCodeScanner.stop();
        }
        qrScannerContainer.style.display = "none";
        scanResults.style.display = "none";
        startScannerButton.style.display = "block";
        stopScannerButton.style.display = "none";
    });

    confirmCollectionButton.addEventListener("click", async () => {
        if (!currentScannedData) return;
        await handleScan(currentScannedData);
    });

    dismissResultButton.addEventListener("click", () => {
        resetScanResults();
    });

    /* =====================================================
       Complaints - Student Feedback
    ===================================================== */

    const complaintList = document.getElementById("complaintList");
    const refreshComplaintsButton = document.getElementById("refreshComplaintsButton");

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
            complaintList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>No complaints</h3><p>Your hall has no student complaints right now.</p></div>`;
            return;
        }

        complaintList.innerHTML = complaints.map((complaint) => `
            <article class="complaint-item" data-complaint-id="${complaint.id}">
                <div class="complaint-item-header">
                    <div>
                        <h3>${escapeHtml(complaint.subject)}</h3>
                        <div class="complaint-item-meta">${escapeHtml(complaint.student_name || "Unknown student")} · ${formatComplaintDate(complaint.created_at)}</div>
                    </div>
                    <span class="complaint-status status-${complaint.status}">${formatComplaintStatus(complaint.status)}</span>
                </div>
                <p class="complaint-message">${escapeHtml(complaint.message)}</p>
                ${complaint.staff_response ? `<div class="complaint-response"><strong>Your response:</strong> ${escapeHtml(complaint.staff_response)}</div>` : ""}
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
            const data = await apiRequest("/complaints");
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
            try {
                await loadComplaints();
                showToast("Complaints refreshed.");
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    }

    // Navigation active state
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
            item.classList.add("active");
        });
    });

    todayDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date());
    document.getElementById("mealDate").min = nextDayValue();
    document.getElementById("mealDate").value = nextDayValue();

    try {
        await loadProfile();
        await loadMeals();
        await loadPayments();
        await loadComplaints();
        staffMessage.textContent = "Your staff workspace is securely connected.";
        staffMessage.classList.add("message-success");
    } catch (error) {
        staffMessage.textContent = error.message || "Unable to load the staff workspace.";
        staffMessage.classList.add("message-error");
    }
});
