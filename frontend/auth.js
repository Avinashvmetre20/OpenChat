const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.add("active");
  registerForm.classList.remove("active");
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.add("active");
  loginForm.classList.remove("active");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mobile = document.getElementById("login-mobile").value;
  const password = document.getElementById("login-password").value;
  const msg = document.getElementById("login-msg");

  try {
    const res = await fetch("/api/auth/login", {
    // const res = await fetch("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, password }),
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem("token", data.token);
      msg.style.color = "green";
      msg.textContent = "Login successful!";
      setTimeout(() => {
        window.location.href = "/chat.html"; // redirect after login
      }, 1000);
    } else {
      msg.style.color = "red";
      msg.textContent = data.msg || "Login failed";
    }
  } catch (err) {
    msg.textContent = "Server error";
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("register-name").value;
  const mobile = document.getElementById("register-mobile").value;
  const password = document.getElementById("register-password").value;
  const msg = document.getElementById("register-msg");

  try {
    const res = await fetch("/api/auth/register", {
    // const res = await fetch("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mobile, password }),
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem("token", data.token);
      msg.style.color = "green";
      msg.textContent = "Registered successfully!";
      setTimeout(() => {
        window.location.href = "/chat.html";
      }, 1000);
    }
    else {
      msg.style.color = "red";
      msg.textContent = data.msg || "Registration failed";
    }
  } catch (err) {
    msg.textContent = "Server error";
  }
});