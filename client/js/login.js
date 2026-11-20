/* =====================================================
   FoodFlow - Login Authentication
   Connects with:
   POST /api/auth/login
===================================================== */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    const loginButton = document.getElementById("loginButton");
    const loginButtonText = document.getElementById("loginButtonText");

    const message = document.getElementById("message");

    const togglePassword =
        document.getElementById("togglePassword");

    const forgotPassword =
        document.getElementById("forgotPassword");

    const forgotDialog =
        document.getElementById("forgotDialog");

    const closeForgotDialog =
        document.getElementById("closeForgotDialog");


    /* =================================================
       Backend API Configuration
    ================================================= */

    const API_BASE_URL = window.FOODFLOW_API_BASE_URL;


    /* =================================================
       Show Message
    ================================================= */

    function showMessage(text, type = "error") {

        message.textContent = text;

        message.classList.remove(
            "message-success",
            "message-error"
        );

        if (type === "success") {
            message.classList.add("message-success");
        } else {
            message.classList.add("message-error");
        }
    }


    /* =================================================
       Clear Message
    ================================================= */

    function clearMessage() {

        message.textContent = "";

        message.classList.remove(
            "message-success",
            "message-error"
        );
    }


    /* =================================================
       Loading State
    ================================================= */

    function setLoading(isLoading) {

        loginButton.disabled = isLoading;

        if (isLoading) {

            loginButtonText.textContent = "Signing in...";

        } else {

            loginButtonText.textContent = "Sign in";
        }
    }


    /* =================================================
       Password Visibility
    ================================================= */

    if (togglePassword) {

        togglePassword.addEventListener("click", () => {

            const isPassword =
                passwordInput.type === "password";

            passwordInput.type =
                isPassword ? "text" : "password";

            togglePassword.textContent =
                isPassword ? "Hide" : "Show";
        });
    }


    /* =================================================
       Login
    ================================================= */

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearMessage();

        const email =
            emailInput.value.trim().toLowerCase();

        const password =
            passwordInput.value;


        /* ---------------------------------------------
           Client-side validation
        --------------------------------------------- */

        if (!email || !password) {

            showMessage(
                "Please enter your email and password."
            );

            return;
        }


        if (!emailInput.checkValidity()) {

            showMessage(
                "Please enter a valid email address."
            );

            emailInput.focus();

            return;
        }


        setLoading(true);


        try {

            /* -----------------------------------------
               Send login request
            ----------------------------------------- */

            const response = await fetch(
                `${API_BASE_URL}/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );


            /* -----------------------------------------
               Read server response
            ----------------------------------------- */

            const data = await response.json().catch(() => ({}));


            /* -----------------------------------------
               Handle failed login
            ----------------------------------------- */

            if (!response.ok || !data.success) {

                showMessage(
                    data.message ||
                    "Login failed. Please check your credentials."
                );

                setLoading(false);

                return;
            }


            /* -----------------------------------------
               Make sure token exists
            ----------------------------------------- */

            if (!data.token || !data.user) {

                showMessage(
                    "Login response is incomplete. Please try again."
                );

                setLoading(false);

                return;
            }


            /* -----------------------------------------
               Store authentication data
            ----------------------------------------- */

            localStorage.setItem(
                "foodflow_token",
                data.token
            );

            localStorage.setItem(
                "foodflow_user",
                JSON.stringify(data.user)
            );

            // Make sure a fresh login always replays the
            // dashboard welcome walk-in animation, even if
            // it already played earlier in this browser tab.
            sessionStorage.removeItem(
                "foodflow_welcome_played"
            );


            /* -----------------------------------------
               Success message
            ----------------------------------------- */

            showMessage(
                `Welcome back, ${data.user.name}!`,
                "success"
            );


            /* -----------------------------------------
               Redirect according to role
            ----------------------------------------- */

            setTimeout(() => {

                redirectByRole(data.user.role);

            }, 700);


        } catch (error) {

            console.error(
                "FoodFlow login error:",
                error
            );

            showMessage(
                "Unable to connect to the server. Please make sure the FoodFlow server is running."
            );

        } finally {

            setTimeout(() => {
                setLoading(false);
            }, 700);
        }
    });


    /* =================================================
       Role-based Dashboard Redirect
    ================================================= */

    function redirectByRole(role) {

        switch (role) {

            case "student":

                window.location.href =
                    "student-dashboard.html";

                break;


            case "staff":

                window.location.href =
                    "staff-dashboard.html";

                break;


            case "admin":

                window.location.href =
                    "admin-dashboard.html";

                break;


            default:

                localStorage.removeItem(
                    "foodflow_token"
                );

                localStorage.removeItem(
                    "foodflow_user"
                );

                showMessage(
                    "Your account role is not recognized. Please contact the administrator."
                );
        }
    }


    /* =================================================
       Forgot Password Dialog
    ================================================= */

    if (
        forgotPassword &&
        forgotDialog &&
        closeForgotDialog
    ) {

        forgotPassword.addEventListener(
            "click",
            () => {

                forgotDialog.showModal();

            }
        );


        closeForgotDialog.addEventListener(
            "click",
            () => {

                forgotDialog.close();

            }
        );


        forgotDialog.addEventListener(
            "click",
            (event) => {

                if (event.target === forgotDialog) {

                    forgotDialog.close();
                }
            }
        );
    }

});