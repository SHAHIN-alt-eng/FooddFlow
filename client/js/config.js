"use strict";

(() => {
  const configuredUrl = document.querySelector(
    'meta[name="foodflow-api-base-url"]'
  )?.content;
  const hostname = window.location.hostname || "localhost";
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const defaultUrl = isLocal
    ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${hostname}:5000/api`
    : "https://fooddflow.onrender.com/api";

  window.FOODFLOW_API_BASE_URL = (configuredUrl || defaultUrl).replace(/\/+$/, "");
})();
