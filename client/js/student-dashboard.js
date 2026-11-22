"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    /* =====================================================
       FoodFlow - Student Dashboard

       Connects with:
       GET  /api/auth/profile
       GET  /api/meals/today
       GET  /api/reservations
       POST /api/reservations
       DELETE /api/reservations/:id

       QR:
       reservation.qr_token
       reservation.qrToken
       ===================================================== */

    const API_BASE_URL = window.FOODFLOW_API_BASE_URL;

    const token = localStorage.getItem("foodflow_token");

    const storedUser =
        JSON.parse(
            localStorage.getItem("foodflow_user") || "null"
        );


    /* =====================================================
       Required Elements
       ===================================================== */

    const studentName =
        document.getElementById("studentName");

    const profileName =
        document.getElementById("profileName");

    const profileRole =
        document.getElementById("profileRole");

    const avatarInitial =
        document.getElementById("avatarInitial");

    const largeAvatarInitial =
        document.getElementById("largeAvatarInitial");

    const detailName =
        document.getElementById("detailName");

    const detailEmail =
        document.getElementById("detailEmail");

    const detailRole =
        document.getElementById("detailRole");

    const accountStatus =
        document.getElementById("accountStatus");

    const todayMeal =
        document.getElementById("todayMeal");

    const todayMealStatus =
        document.getElementById("todayMealStatus");

    const reservationCount =
        document.getElementById("reservationCount");

    const mealHistoryCount =
        document.getElementById("mealHistoryCount");

    const missedMealCount =
        document.getElementById("missedMealCount");

    const dashboardMessage =
        document.getElementById("dashboardMessage");

    const logoutButton =
        document.getElementById("logoutButton");

    const dashboardSkeleton =
        document.getElementById("dashboardSkeleton");

    const toast =
        document.getElementById("toast");

    const hallSelect = document.getElementById("hallSelect");
    const mealHallFilter = document.getElementById("mealHallFilter");
    const complaintHallSelect = document.getElementById("complaintHallSelect");
    let currentUser = storedUser;
    let allTodayMeals = [];
    let selectedMealHall = "";
    const HALLS_BY_GENDER = {
        male: ["Shaheed President Zia Hall", "Abdul Hamid Hall", "Tinshed Hall", "Shohidul Hall", "Shere-e-Bangla A K Fazlul Haque Hall", "Selim Hall", "Male Hall-1", "Male Hall-2", "Male Hall-3"],
        female: ["Female Hall 1", "Female Hall 2"]
    };

    function setHallTheme(hall) {
        const theme = hall ? hall.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "default";
        document.body.dataset.hallTheme = theme;
    }

    /*
     * Populate the hall selector with halls available to the student.
     * Meals remain hidden until the student selects one hall.
     */
    function setupMealHallFilter(user) {

        const halls = HALLS_BY_GENDER[user?.gender] || [];

        if (mealHallFilter) {
            mealHallFilter.replaceChildren(
                new Option("Choose a hall", ""),
                ...halls.map((hall) => new Option(hall, hall))
            );

            mealHallFilter.value = selectedMealHall;

            mealHallFilter.addEventListener("change", () => {
                selectedMealHall = mealHallFilter.value;
                if (complaintHallSelect) {
                    complaintHallSelect.value = selectedMealHall;
                }
                const title = document.getElementById("todayMealsTitle");
                if (title) {
                    title.textContent = selectedMealHall
                        ? `${selectedMealHall} meals`
                        : "Choose a hall to view meals";
                }
                renderTodayMeals(filterMealsByHall(allTodayMeals));
            });
        }

        if (complaintHallSelect) {
            complaintHallSelect.replaceChildren(
                new Option("Choose a hall", ""),
                ...halls.map((hall) => new Option(hall, hall))
            );
            complaintHallSelect.value = halls.includes(selectedMealHall)
                ? selectedMealHall
                : halls.includes(user?.hall_name) ? user.hall_name : "";
        }
    }

    function filterMealsByHall(meals) {
        if (!selectedMealHall) {
            return [];
        }

        return meals.filter(
            (meal) => meal.hall_name === selectedMealHall
        );
    }

    const cancelReservationDialog =
        document.getElementById(
            "cancelReservationDialog"
        );

    const keepReservationButton =
        document.getElementById(
            "keepReservationButton"
        );

    const confirmCancelReservationButton =
        document.getElementById(
            "confirmCancelReservationButton"
        );


    const reservedMealIds = new Set();


    /* =====================================================
       Authentication Check
       ===================================================== */

    if (!token) {

        window.location.href = "login.html";

        return;
    }


    /* =====================================================
       Helper: Show Dashboard Message
       ===================================================== */

    function showMessage(
        text,
        type = "error"
    ) {

        if (!dashboardMessage) {
            return;
        }

        dashboardMessage.textContent = text;

        dashboardMessage.classList.remove(
            "message-success",
            "message-error"
        );

        dashboardMessage.classList.add(
            type === "success"
                ? "message-success"
                : "message-error"
        );
    }


    /* =====================================================
       Helper: Toast
       ===================================================== */

    function showToast(
        text,
        type = "success"
    ) {

        if (!toast) {
            return;
        }

        toast.textContent = text;

        toast.className =
            `toast toast-${type} toast-visible`;

        window.setTimeout(() => {

            toast.classList.remove(
                "toast-visible"
            );

        }, 2800);
    }


    /* =====================================================
       Helper: Confirmation Dialog
       ===================================================== */

    function confirmCancellation() {

        if (
            !cancelReservationDialog ||
            !keepReservationButton ||
            !confirmCancelReservationButton
        ) {

            return Promise.resolve(
                window.confirm(
                    "Are you sure you want to cancel this reservation?"
                )
            );
        }


        return new Promise((resolve) => {

            const close = (confirmed) => {

                if (
                    cancelReservationDialog.open
                ) {

                    cancelReservationDialog.close();
                }

                keepReservationButton.onclick =
                    null;

                confirmCancelReservationButton.onclick =
                    null;

                cancelReservationDialog.oncancel =
                    null;

                resolve(confirmed);
            };


            keepReservationButton.onclick =
                () => close(false);


            confirmCancelReservationButton.onclick =
                () => close(true);


            cancelReservationDialog.oncancel =
                () => close(false);


            cancelReservationDialog.showModal();

            keepReservationButton.focus();
        });
    }


    /* =====================================================
       Helper: Get Initial
       ===================================================== */

    function getInitial(name) {

        if (
            !name ||
            typeof name !== "string"
        ) {

            return "S";
        }

        return name
            .trim()
            .charAt(0)
            .toUpperCase();
    }


    /* =====================================================
       Helper: Display User
       ===================================================== */

    function displayUser(user) {

        currentUser = user;

        if (hallSelect) {
            const halls = HALLS_BY_GENDER[user.gender] || [];
            hallSelect.replaceChildren(new Option("Default theme", ""), ...halls.map((hall) => new Option(hall, hall)));
            hallSelect.disabled = halls.length === 0;
            hallSelect.addEventListener("change", () => setHallTheme(hallSelect.value));
        }

        setupMealHallFilter(user);

        const name =
            user.name || "Student";

        const email =
            user.email || "—";

        const role =
            user.role || "student";

        const initial =
            getInitial(name);


        /* Header */

        if (studentName) {
            studentName.textContent = name;
        }

        if (profileName) {
            profileName.textContent = name;
        }

        if (profileRole) {

            profileRole.textContent =
                role.charAt(0).toUpperCase() +
                role.slice(1);
        }


        /* Avatar */

        if (avatarInitial) {
            avatarInitial.textContent = initial;
        }

        if (largeAvatarInitial) {
            largeAvatarInitial.textContent = initial;
        }


        /* Profile Details */

        if (detailName) {
            detailName.textContent = name;
        }

        if (detailEmail) {
            detailEmail.textContent = email;
        }

        if (detailRole) {

            detailRole.textContent =
                role.charAt(0).toUpperCase() +
                role.slice(1);
        }


        /* Account Status */

        if (accountStatus) {

            const status =
                user.status || "active";

            accountStatus.textContent =
                status.charAt(0).toUpperCase() +
                status.slice(1);
        }
    }


    /* =====================================================
       Fetch Current User
       ===================================================== */

    async function loadCurrentUser() {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/auth/profile`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        }
                    }
                );


            if (response.status === 401) {

                localStorage.removeItem(
                    "foodflow_token"
                );

                localStorage.removeItem(
                    "foodflow_user"
                );

                window.location.href =
                    "login.html";

                return;
            }


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load your profile."
                );
            }


            if (data.user) {

                displayUser(data.user);


                localStorage.setItem(
                    "foodflow_user",
                    JSON.stringify(data.user)
                );
            }


            showMessage(
                "Your account is securely connected.",
                "success"
            );

            showToast(
                "Profile synced successfully."
            );


        } catch (error) {

            console.error(
                "FoodFlow dashboard error:",
                error
            );


            if (storedUser) {

                displayUser(storedUser);

                showMessage(
                    "Profile loaded from your saved login session.",
                    "success"
                );

                showToast(
                    "Using your saved profile.",
                    "info"
                );

            } else {

                showMessage(
                    "Unable to load your account information."
                );
            }
        }
    }


    /* =====================================================
       Meal Card Helpers
       ===================================================== */

    function formatMealType(mealType) {

        const value =
            typeof mealType === "string"
                ? mealType.trim()
                : "";

        return value
            ? value.charAt(0).toUpperCase() +
                value.slice(1)
            : "Meal";
    }

    function initializeOverviewReservationPanels() {
        document.querySelectorAll("[data-reservation-dialog]").forEach((card) => {
            const dialog = document.getElementById(card.dataset.reservationDialog);
            if (!dialog) return;

            const openDialog = () => {
                if (!dialog.open) dialog.showModal();
            };

            card.addEventListener("click", openDialog);

            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDialog();
                }
            });
        });

        document.querySelectorAll("[data-close-dialog]").forEach((button) => {
            button.addEventListener("click", () => {
                document.getElementById(button.dataset.closeDialog)?.close();
            });
        });
    }


    function getAvailableSeats(meal) {

        const capacity =
            Number(meal.capacity);

        const reservedCount =
            Number(meal.reserved_count);


        if (
            !Number.isFinite(capacity) ||
            !Number.isFinite(reservedCount)
        ) {

            return 0;
        }


        return Math.max(
            0,
            capacity - reservedCount
        );
    }


    function setMealsEmptyState(
        title,
        message,
        icon = "◫"
    ) {

        const mealsContainer =
            document.getElementById(
                "todayMealsList"
            );

        if (!mealsContainer) {
            return;
        }

        mealsContainer.replaceChildren();


        const emptyState =
            document.createElement("div");

        emptyState.className =
            "empty-state";


        const emptyIcon =
            document.createElement("div");

        emptyIcon.className =
            "empty-icon";

        emptyIcon.textContent =
            icon;


        const heading =
            document.createElement("h3");

        heading.textContent =
            title;


        const description =
            document.createElement("p");

        description.textContent =
            message;


        emptyState.append(
            emptyIcon,
            heading,
            description
        );


        mealsContainer.appendChild(
            emptyState
        );
    }


    /* =====================================================
       Render Today's Meals

       Renders whatever meal list is passed in (already
       filtered by hall, if a hall filter is selected) without
       re-fetching from the server.
       ===================================================== */

    function renderTodayMeals(meals) {

        const mealsContainer =
            document.getElementById(
                "todayMealsList"
            );

        if (!mealsContainer) {
            return;
        }


        if (!meals.length) {

            setMealsEmptyState(
                selectedMealHall
                    ? `No meals available for ${selectedMealHall} tomorrow`
                    : "Select a hall to see its meals",
                selectedMealHall
                    ? "This hall has not published any available meals for tomorrow yet."
                    : "Choose your hall from the dropdown above to view and reserve its published meals."
            );

            return;
        }


        mealsContainer.replaceChildren(

            ...meals.map((meal) => {

                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "meal-card";

                card.dataset.mealId =
                    String(
                        meal.id || ""
                    );


                const content =
                    document.createElement(
                        "div"
                    );

                content.className =
                    "meal-card-content";


                const label =
                    document.createElement(
                        "span"
                    );

                label.className =
                    "card-label";

                label.textContent =
                    formatMealType(
                        meal.meal_type
                    );


                const title =
                    document.createElement(
                        "h3"
                    );

                title.textContent =
                    meal.menu_name ||
                    "Today's Meal";


                const hallBadge =
                    document.createElement(
                        "span"
                    );

                hallBadge.className =
                    "meal-card-hall";

                hallBadge.textContent =
                    meal.hall_name ||
                    "Hall not specified";


                const description =
                    document.createElement(
                        "p"
                    );

                description.textContent =
                    meal.description ||
                    "Freshly prepared meal from FoodFlow.";


                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "meal-meta";


                const seats =
                    getAvailableSeats(
                        meal
                    );


                const seatsText =
                    document.createElement(
                        "span"
                    );

                seatsText.textContent =
                    `${seats} ${
                        seats === 1
                            ? "seat"
                            : "seats"
                    } available`;


                meta.appendChild(
                    seatsText
                );

                const priceText = document.createElement("span");
                priceText.textContent = `৳${Number(meal.price || 0).toFixed(2)}`;
                meta.appendChild(priceText);


                content.append(
                    label,
                    title,
                    hallBadge,
                    description,
                    meta
                );


                const action =
                    document.createElement(
                        "div"
                    );

                action.className =
                    "meal-card-action";


                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "reserve-meal-button";

                button.dataset.mealId =
                    String(
                        meal.id || ""
                    );


                const deadline =
                    meal.reservation_deadline
                        ? new Date(
                            meal.reservation_deadline
                        )
                        : null;


                const deadlinePassed =
                    deadline &&
                    !Number.isNaN(
                        deadline.getTime()
                    ) &&
                    deadline.getTime() <=
                        Date.now();


                const alreadyReserved =
                    reservedMealIds.has(
                        Number(meal.id)
                    );


                const unavailable =
                    seats <= 0 ||
                    meal.status !== "available" ||
                    deadlinePassed;


                if (alreadyReserved) {

                    button.disabled = true;

                    button.textContent =
                        "Reserved";

                } else if (unavailable) {

                    button.disabled = true;

                    button.textContent =
                        seats <= 0
                            ? "Meal Full"
                            : deadlinePassed
                                ? "Reservation Closed"
                                : "Unavailable";

                } else {

                    button.textContent =
                        `Pay ৳${Number(meal.price || 0).toFixed(2)} with bKash`;


                    button.addEventListener(
                        "click",
                        async () => {

                            button.disabled =
                                true;

                            const originalText =
                                button.textContent;

                            button.textContent =
                                "Opening bKash...";


                            try {

                                await reserveMeal(meal.id);

                            } catch (error) {

                                button.disabled =
                                    false;

                                button.textContent =
                                    originalText;
                            }
                        }
                    );
                }


                action.appendChild(
                    button
                );


                card.append(
                    content,
                    action
                );


                return card;
            })
        );
    }


    /* =====================================================
       Fetch Today's Meals
       ===================================================== */

    async function loadTodayMeals() {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/meals/today`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        }
                    }
                );


            if (response.status === 401) {

                localStorage.removeItem(
                    "foodflow_token"
                );

                localStorage.removeItem(
                    "foodflow_user"
                );

                window.location.href =
                    "login.html";

                return;
            }


            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load tomorrow's meals."
                );
            }


            const meals =
                Array.isArray(data.meals)
                    ? data.meals
                    : [];


            allTodayMeals = meals;


            const firstMeal =
                meals[0];


            if (todayMeal) {

                todayMeal.textContent =
                    firstMeal?.menu_name ||
                    "No meal available";
            }


            if (todayMealStatus) {
                const status = reservedMealIds.has(Number(firstMeal?.id))
                    ? "reserved"
                    : "available";
                todayMealStatus.textContent = firstMeal
                    ? `${formatMealType(firstMeal.meal_type)} ${status}`
                    : "Check back later for tomorrow's menu";
            }


            if (
                reservationCount &&
                Number.isFinite(
                    Number(data.reservationCount)
                )
            ) {

                reservationCount.textContent =
                    String(
                        data.reservationCount
                    );
            }


            renderTodayMeals(
                filterMealsByHall(meals)
            );


        } catch (error) {

            console.error(
                "FoodFlow meal loading error:",
                error
            );


            if (todayMeal) {

                todayMeal.textContent =
                    "Meal unavailable";
            }


            if (todayMealStatus) {

                todayMealStatus.textContent =
                    "Unable to sync tomorrow's menu";
            }


            setMealsEmptyState(
                "Tomorrow's meals are unavailable",
                "We couldn't connect to the meal service. Please try again shortly.",
                "!"
            );
        }
    }


    /* =====================================================
       Reservation API Helper
       ===================================================== */

    async function requestReservation(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                `${API_BASE_URL}${url}`,
                {
                    ...options,

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json",

                        ...(options.headers || {})
                    }
                }
            );


        if (response.status === 401) {

            localStorage.removeItem(
                "foodflow_token"
            );

            localStorage.removeItem(
                "foodflow_user"
            );

            window.location.href =
                "login.html";

            return null;
        }


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                data.error ||
                "Reservation request failed."
            );
        }


        return data;
    }


    /* =====================================================
       Get QR Token
       ===================================================== */

    function getQrToken(reservation) {

        if (!reservation) {
            return null;
        }


        /*
         * Support multiple backend naming styles.
         */

        return (
            reservation.qr_token ||
            reservation.qrToken ||
            reservation.reservation_qr_token ||
            reservation.token ||
            reservation.qr?.token ||
            null
        );
    }


    /* =====================================================
       Generate Stylish FoodFlow QR
       ===================================================== */

    function generateReservationQR(
        container,
        reservation
    ) {

        if (!container) {
            return;
        }


        container.replaceChildren();


        const qrToken =
            getQrToken(
                reservation
            );


        /*
         * Backend token না দিলে
         * dashboard break করবে না।
         */

        if (!qrToken) {

            const unavailable =
                document.createElement(
                    "div"
                );

            unavailable.className =
                "qr-unavailable";

            unavailable.textContent =
                "QR token is not available for this reservation yet.";

            container.appendChild(
                unavailable
            );

            return;
        }


        /*
         * QR library check
         */

        if (
            typeof QRCode ===
            "undefined"
        ) {

            const unavailable =
                document.createElement(
                    "div"
                );

            unavailable.className =
                "qr-unavailable";

            unavailable.textContent =
                "QR service is unavailable. Please refresh the page.";

            container.appendChild(
                unavailable
            );

            return;
        }


        /* Main QR Card */

        const qrCard =
            document.createElement(
                "div"
            );

        qrCard.className =
            "reservation-qr-card";


        /* Brand */

        const brand =
            document.createElement(
                "div"
            );

        brand.className =
            "qr-brand";


        const brandLogo =
            document.createElement(
                "img"
            );

        brandLogo.className =
            "qr-brand-logo";

        brandLogo.src =
            "assets/foodflow-logo.svg";

        brandLogo.alt =
            "FoodFlow";


        const brandName =
            document.createElement(
                "div"
            );

        brandName.className =
            "qr-brand-name";

        brandName.innerHTML =
            `
                <span class="qr-food">Food</span><span class="qr-flow">Flow</span>
            `;


        brand.append(
            brandLogo,
            brandName
        );


        /* Instruction */

        const instruction =
            document.createElement(
                "p"
            );

        instruction.className =
            "qr-instruction";

        instruction.textContent =
            "Show this QR at meal collection";


        /* QR Wrapper */

        const qrWrapper =
            document.createElement(
                "div"
            );

        qrWrapper.className =
            "qr-code-wrapper";


        const qrCode =
            document.createElement(
                "div"
            );

        qrCode.className =
            "qr-code";


        qrWrapper.appendChild(
            qrCode
        );


        /* Generate QR */

        try {

            new QRCode(
                qrCode,
                {
                    text: String(
                        qrToken
                    ),

                    width: 200,

                    height: 200,

                    correctLevel:
                        QRCode.CorrectLevel.H
                }
            );

        } catch (error) {

            console.error(
                "FoodFlow QR generation error:",
                error
            );

            const unavailable =
                document.createElement(
                    "div"
                );

            unavailable.className =
                "qr-unavailable";

            unavailable.textContent =
                "Unable to generate QR code.";

            qrCode.replaceChildren(
                unavailable
            );

            return;
        }


        /*
         * FoodFlow logo overlay.
         *
         * QR-এর center এ logo থাকবে।
         */

        const centerLogo =
            document.createElement(
                "img"
            );

        centerLogo.className =
            "qr-center-logo";

        centerLogo.src =
            "assets/foodflow-logo.svg";

        centerLogo.alt =
            "FoodFlow";


        qrWrapper.appendChild(
            centerLogo
        );


        /* FoodFlow Label */

        const foodFlowLabel =
            document.createElement(
                "div"
            );

        foodFlowLabel.className =
            "qr-foodflow-label";

        foodFlowLabel.textContent =
            "FOODFLOW";


        /* Reservation ID */

        const reservationId =
            document.createElement(
                "div"
            );

        reservationId.className =
            "qr-reservation-id";

        const reservationIdStrong =
            document.createElement(
                "strong"
            );

        reservationIdStrong.textContent =
            reservation.id
                ? `#${reservation.id}`
                : "Reservation";


        reservationId.append(
            "Reservation ",
            reservationIdStrong
        );


        qrCard.append(
            brand,
            instruction,
            qrWrapper,
            foodFlowLabel,
            reservationId
        );


        container.appendChild(
            qrCard
        );
    }


    /* =====================================================
       Load Reservations
       ===================================================== */

    async function loadReservations() {

        try {

            const data =
                await requestReservation(
                    "/reservations"
                );


            if (!data) {
                return;
            }


            const reservations =
                Array.isArray(
                    data.reservations
                )
                    ? data.reservations
                    : [];


            reservedMealIds.clear();


            reservations
                .filter(
                    (reservation) =>
                        reservation.status === "reserved" &&
                        !isPastMeal(reservation)
                )
                .forEach(
                    (reservation) => {

                        reservedMealIds.add(
                            Number(
                                reservation.meal_id
                            )
                        );
                    }
                );


            const todayReservations = reservations.filter(
                (reservation) => reservation.status === "reserved" &&
                    !isPastMeal(reservation)
            );
            const missedReservations = reservations.filter(
                (reservation) => reservation.status === "reserved" &&
                    isPastMeal(reservation)
            );
            const mealHistory = reservations.filter(
                (reservation) => reservation.status !== "reserved"
            );

            if (mealHistoryCount) {
                mealHistoryCount.textContent = String(mealHistory.length);
            }

            if (missedMealCount) {
                missedMealCount.textContent = String(missedReservations.length);
            }

            renderReservations(
                todayReservations,
                "reservationList",
                "No reservations for today",
                "Your valid reservations for today will appear here."
            );
            renderReservations(
                mealHistory,
                "mealHistoryList",
                "No meal history yet",
                "Completed and cancelled meals will appear here."
            );
            renderReservations(
                missedReservations,
                "missedMealList",
                "No missed meals",
                "Reservations not collected before their meal date appear here."
            );


            if (reservationCount) {

                reservationCount.textContent =
                    String(
                        reservations.filter(
                            (reservation) =>
                                reservation.status === "reserved" &&
                                !isPastMeal(reservation)
                        ).length
                    );
            }


        } catch (error) {

            console.error(
                "FoodFlow reservation loading error:",
                error
            );


            const reservationList =
                document.getElementById(
                    "reservationList"
                );


            if (reservationList) {
                const emptyState = document.createElement("div");
                emptyState.className = "empty-state";

                const icon = document.createElement("div");
                icon.className = "empty-icon";
                icon.textContent = "!";

                const title = document.createElement("h3");
                title.textContent = "Reservations unavailable";

                const message = document.createElement("p");
                const reason = error instanceof Error ? error.message : "";
                message.textContent = reason
                    ? `We could not sync your reservations: ${reason}`
                    : "We could not sync your reservations right now.";

                emptyState.append(icon, title, message);
                reservationList.replaceChildren(emptyState);
            }
        }
    }


    /* =====================================================
       Reserve Meal
       ===================================================== */

    async function reserveMeal(mealId) {

        const parsedMealId =
            Number(mealId);


        if (
            !Number.isInteger(
                parsedMealId
            ) ||
            parsedMealId <= 0
        ) {

            showToast(
                "Invalid meal selected.",
                "error"
            );

            return;
        }


        try {

            const data =
                await requestReservation(
                    "/payments/bkash/create",
                    {
                        method: "POST",

                        body: JSON.stringify(
                            { meal_id: parsedMealId }
                        )
                    }
                );


            if (!data) {
                return;
            }


            const paymentUrl = data?.payment?.bkashURL;
            if (data?.payment?.demo && data.payment.paymentID) {
                window.location.assign(`bkash-demo.html?paymentId=${encodeURIComponent(data.payment.paymentID)}&amount=${encodeURIComponent(data.payment.amount)}`);
                return;
            }
            if (!paymentUrl) throw new Error("bKash payment link was not returned.");
            window.location.assign(paymentUrl);


        } catch (error) {

            showToast(
                error.message,
                "error"
            );

            throw error;
        }
    }


    /* =====================================================
       Format Reservation Date
       ===================================================== */

    function formatReservationDate(
        value
    ) {

        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "Date unavailable";
        }


        return new Intl.DateTimeFormat(
            undefined,
            {
                weekday: "short",
                month: "short",
                day: "numeric"
            }
        ).format(date);
    }

    function reservationDateKey(value) {
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return value.slice(0, 10);
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? ""
            : FoodFlowDate.dateKey(date);
    }

    function isPastMeal(reservation) {
        const mealDate = reservation.meal_date || reservation.meal?.meal_date;

        return reservationDateKey(mealDate) < FoodFlowDate.dateKey();
    }


    /* =====================================================
       Render Reservations
       ===================================================== */

    function renderReservations(
        reservations,
        listId = "reservationList",
        emptyTitle = "No reservations yet",
        emptyMessage = "Your upcoming meal reservations will appear here."
    ) {

        const reservationList =
            document.getElementById(
                listId
            );


        if (!reservationList) {
            return;
        }


        if (!reservations.length) {

            reservationList.innerHTML =
                `
                <div class="empty-state">

                    <div class="empty-icon">
                        ◫
                    </div>

                    <h3>
                        ${emptyTitle}
                    </h3>

                    <p>
                        ${emptyMessage}
                    </p>

                </div>
                `;

            return;
        }


        reservationList.replaceChildren(

            ...reservations
                .map((reservation) => {


                    /* ==================================
                       Reservation Item
                    =================================== */

                    const item =
                        document.createElement(
                            "article"
                        );

                    item.className =
                        "reservation-item";


                    /* ==================================
                       Reservation Details
                    =================================== */

                    const details =
                        document.createElement(
                            "div"
                        );

                    details.className =
                        "reservation-details";


                    const title =
                        document.createElement(
                            "strong"
                        );

                    title.textContent =
                        reservation.menu_name ||
                        reservation.meal?.menu_name ||
                        "Reserved meal";


                    const meta =
                        document.createElement(
                            "span"
                        );

                    meta.textContent =
                        `${formatReservationDate(
                            reservation.meal_date ||
                            reservation.meal?.meal_date
                        )} · ${
                            reservation.meal_type ||
                            reservation.meal?.meal_type ||
                            "Meal"
                        } · ${reservation.hall_name || "Hall not selected"}`;


                    details.append(
                        title,
                        meta
                    );


                    item.appendChild(
                        details
                    );


                    /* ==================================
                       Status
                    =================================== */

                    const status =
                        document.createElement(
                            "span"
                        );

                    status.className =
                        `reservation-status status-${reservation.status}`;

                    const expired = reservation.status === "reserved" &&
                        isPastMeal(reservation);

                    if (expired) {
                        status.className = "reservation-status status-expired";
                    }

                    status.textContent =
                        expired ? "Expired" : reservation.status || "unknown";


                    item.appendChild(
                        status
                    );

                    if (
                        reservation.refund_status === "pending" ||
                        reservation.refund_status === "refunded"
                    ) {
                        const refund = document.createElement("p");
                        refund.className = "reservation-refund";
                        const amount = Number(reservation.payment_amount || 0);
                        const refundedOn = reservation.refund_status === "refunded" &&
                            reservation.refunded_at
                            ? new Intl.DateTimeFormat(undefined, {
                                month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            }).format(new Date(reservation.refunded_at))
                            : "";
                        refund.textContent = reservation.refund_status === "pending"
                            ? `Refund pending · ৳${amount.toFixed(2)}`
                            : `Refunded ৳${amount.toFixed(2)} · ${refundedOn}`;
                        item.appendChild(refund);
                    }


                    /* ==================================
                       QR SECTION
                    =================================== */

                    if (
                        reservation.status === "reserved" &&
                        !expired
                    ) {

                        const qrSection =
                            document.createElement(
                                "div"
                            );

                        qrSection.className =
                            "reservation-qr-section";


                        generateReservationQR(
                            qrSection,
                            reservation
                        );


                        item.appendChild(
                            qrSection
                        );
                    }


                    /* ==================================
                       Cancel Button
                    =================================== */

                    const deadlineTime = reservation.reservation_deadline
                        ? new Date(reservation.reservation_deadline).getTime()
                        : null;
                    const canCancel = reservation.status === "reserved" &&
                        !expired &&
                        (!deadlineTime || deadlineTime > Date.now());

                    if (canCancel) {

                        const cancelButton =
                            document.createElement(
                                "button"
                            );

                        cancelButton.type =
                            "button";

                        cancelButton.className =
                            "reservation-cancel";

                        cancelButton.dataset.reservationId =
                            reservation.id;

                        cancelButton.textContent =
                            "Cancel";


                        item.appendChild(
                            cancelButton
                        );
                    }


                    return item;
                })
        );
    }


    /* =====================================================
       Cancel Reservation
       ===================================================== */

    async function cancelReservation(
        reservationId
    ) {

        const parsedReservationId =
            Number(reservationId);


        if (
            !Number.isInteger(
                parsedReservationId
            ) ||
            parsedReservationId <= 0
        ) {

            showToast(
                "Invalid reservation selected.",
                "error"
            );

            return;
        }


        if (
            !await confirmCancellation()
        ) {

            return;
        }


        try {

            const data =
                await requestReservation(
                    `/reservations/${parsedReservationId}`,
                    {
                        method: "DELETE"
                    }
                );


            if (!data) {
                return;
            }


            showToast(data.message || "Reservation cancelled successfully.");


            await loadReservations();

            await loadTodayMeals();


        } catch (error) {

            showToast(
                error.message,
                "error"
            );
        }
    }


    /* =====================================================
       Reservation List Click Handler
       ===================================================== */

    const reservationList =
        document.getElementById(
            "reservationList"
        );


    if (reservationList) {

        reservationList.addEventListener(
            "click",
            (event) => {

                const cancelButton =
                    event.target.closest(
                        ".reservation-cancel"
                    );


                if (cancelButton) {

                    cancelReservation(
                        cancelButton.dataset.reservationId
                    );
                }
            }
        );
    }


    /* =====================================================
       View All Reservations
       ===================================================== */

    const viewAllReservations =
        document.getElementById(
            "viewAllReservations"
        );


    if (viewAllReservations) {

        viewAllReservations.addEventListener(
            "click",
            () => {

                const reservationSection =
                    document.getElementById(
                        "reservations"
                    );


                if (reservationSection) {

                    reservationSection.scrollIntoView(
                        {
                            behavior: "smooth",
                            block: "start"
                        }
                    );
                }
            }
        );
    }


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
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {

                const confirmed = await showLogoutModal();

                if (!confirmed) {
                    return;
                }


                localStorage.removeItem(
                    "foodflow_token"
                );

                localStorage.removeItem(
                    "foodflow_user"
                );


                window.location.href =
                    "login.html";
        });
    }


    /* =====================================================
       Complaint Box
       ===================================================== */

    const complaintForm = document.getElementById("complaintForm");
    const complaintFormStatus = document.getElementById("complaintFormStatus");
    const submitComplaintButton = document.getElementById("submitComplaintButton");
    const complaintList = document.getElementById("complaintList");

    function formatComplaintDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    }

    function formatComplaintStatus(status) {
        const map = {
            pending: "Pending",
            in_progress: "In progress",
            resolved: "Resolved"
        };
        return map[status] || status;
    }

    function renderComplaints(complaints) {
        if (!complaintList) return;

        if (!complaints.length) {
            complaintList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>No complaints yet</h3><p>Anything you submit above will show up here with its status.</p></div>`;
            return;
        }

        complaintList.innerHTML = complaints.map((complaint) => `
            <article class="complaint-item">
                <div class="complaint-item-header">
                    <div>
                        <h3>${escapeHtml(complaint.subject)}</h3>
                        <div class="complaint-item-meta">Submitted ${formatComplaintDate(complaint.created_at)}</div>
                    </div>
                    <span class="complaint-status status-${complaint.status}">${formatComplaintStatus(complaint.status)}</span>
                </div>
                <p class="complaint-message">${escapeHtml(complaint.message)}</p>
                ${complaint.staff_response
                    ? `<div class="complaint-response"><strong>Response:</strong> ${escapeHtml(complaint.staff_response)}</div>`
                    : ""}
            </article>
        `).join("");
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    async function loadComplaints() {
        if (!complaintList) return;

        try {
            const response = await fetch(`${API_BASE_URL}/complaints/my`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.status === 401) {
                localStorage.removeItem("foodflow_token");
                localStorage.removeItem("foodflow_user");
                window.location.href = "login.html";
                return;
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to load your complaints.");
            }

            renderComplaints(Array.isArray(data.complaints) ? data.complaints : []);
        } catch (error) {
            complaintList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>Could not load complaints</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
    }

    if (complaintForm) {
        complaintForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const subject = document.getElementById("complaintSubject").value.trim();
            const message = document.getElementById("complaintMessage").value.trim();
            const hall_name = complaintHallSelect.value;

            if (!hall_name || !subject || !message) {
                complaintFormStatus.textContent = "Please select a hall and fill in both the subject and details.";
                complaintFormStatus.className = "form-status form-status-error";
                return;
            }

            submitComplaintButton.disabled = true;
            complaintFormStatus.textContent = "Submitting your complaint...";
            complaintFormStatus.className = "form-status";

            try {
                const response = await fetch(`${API_BASE_URL}/complaints`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ hall_name, subject, message })
                });

                if (response.status === 401) {
                    localStorage.removeItem("foodflow_token");
                    localStorage.removeItem("foodflow_user");
                    window.location.href = "login.html";
                    return;
                }

                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Unable to submit your complaint.");
                }

                complaintFormStatus.textContent = "Your complaint has been submitted.";
                complaintFormStatus.className = "form-status form-status-success";
                complaintForm.reset();
                showToast("Complaint submitted successfully.");
                await loadComplaints();
            } catch (error) {
                complaintFormStatus.textContent = error.message;
                complaintFormStatus.className = "form-status form-status-error";
                showToast(error.message, "error");
            } finally {
                submitComplaintButton.disabled = false;
            }
        });
    }


    /* =====================================================
       Start Dashboard
       ===================================================== */

    await loadCurrentUser();

    initializeOverviewReservationPanels();

    await loadComplaints();

    await loadReservations();

    await loadTodayMeals();


    if (dashboardSkeleton) {

        dashboardSkeleton.remove();
    }

});
