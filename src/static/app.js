document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupContainer = document.getElementById("signup-container");
  const authBtn = document.getElementById("auth-btn");
  const loggedInUser = document.getElementById("logged-in-user");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLogin = document.getElementById("cancel-login");
  const loginError = document.getElementById("login-error");

  // --- Auth helpers ---
  function getToken() {
    return sessionStorage.getItem("authToken");
  }

  function getUsername() {
    return sessionStorage.getItem("authUsername");
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function showMessage(type, text) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    if (isLoggedIn()) {
      authBtn.textContent = "🔓 Logout";
      loggedInUser.textContent = `Logged in as ${getUsername()}`;
      loggedInUser.classList.remove("hidden");
      signupContainer.classList.remove("hidden");
    } else {
      authBtn.textContent = "👤 Login";
      loggedInUser.classList.add("hidden");
      signupContainer.classList.add("hidden");
    }
    // Re-render activities so delete buttons show/hide correctly
    fetchActivities();
  }

  // --- Login / Logout ---
  authBtn.addEventListener("click", () => {
    if (isLoggedIn()) {
      fetch("/logout", { method: "POST", headers: authHeaders() })
        .finally(() => {
          sessionStorage.removeItem("authToken");
          sessionStorage.removeItem("authUsername");
          updateAuthUI();
        });
    } else {
      loginModal.classList.remove("hidden");
      loginForm.reset();
      loginError.classList.add("hidden");
    }
  });

  cancelLogin.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (response.ok) {
        sessionStorage.setItem("authToken", result.token);
        sessionStorage.setItem("authUsername", result.username);
        loginModal.classList.add("hidden");
        updateAuthUI();
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch {
      loginError.textContent = "Login failed. Please try again.";
      loginError.classList.remove("hidden");
    }
  });

  // Close modal when clicking outside
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.classList.add("hidden");
  });

  // --- Activities ---
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const title = document.createElement("h4");
        title.textContent = name;
        activityCard.appendChild(title);

        const description = document.createElement("p");
        description.textContent = details.description;
        activityCard.appendChild(description);

        const schedule = document.createElement("p");
        const scheduleLabel = document.createElement("strong");
        scheduleLabel.textContent = "Schedule:";
        schedule.appendChild(scheduleLabel);
        schedule.append(` ${details.schedule}`);
        activityCard.appendChild(schedule);

        const availability = document.createElement("p");
        const availabilityLabel = document.createElement("strong");
        availabilityLabel.textContent = "Availability:";
        availability.appendChild(availabilityLabel);
        availability.append(` ${spotsLeft} spots left`);
        activityCard.appendChild(availability);

        const participantsContainer = document.createElement("div");
        participantsContainer.className = "participants-container";

        if (details.participants.length > 0) {
          const participantsSection = document.createElement("div");
          participantsSection.className = "participants-section";

          const heading = document.createElement("h5");
          heading.textContent = "Participants:";
          participantsSection.appendChild(heading);

          const list = document.createElement("ul");
          list.className = "participants-list";

          details.participants.forEach((email) => {
            const listItem = document.createElement("li");
            const emailSpan = document.createElement("span");
            emailSpan.className = "participant-email";
            emailSpan.textContent = email;
            listItem.appendChild(emailSpan);

            if (isLoggedIn()) {
              const deleteBtn = document.createElement("button");
              deleteBtn.className = "delete-btn";
              deleteBtn.setAttribute("data-activity", name);
              deleteBtn.setAttribute("data-email", email);
              deleteBtn.textContent = "❌";
              listItem.appendChild(deleteBtn);
            }

            list.appendChild(listItem);
          });

          participantsSection.appendChild(list);
          participantsContainer.appendChild(participantsSection);
        } else {
          const noParticipants = document.createElement("p");
          const emphasis = document.createElement("em");
          emphasis.textContent = "No participants yet";
          noParticipants.appendChild(emphasis);
          participantsContainer.appendChild(noParticipants);
        }

        activityCard.appendChild(participantsContainer);

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage("success", result.message);

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to unregister. Please try again.");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage("success", result.message);
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to sign up. Please try again.");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app — check session and render
  if (isLoggedIn()) {
    signupContainer.classList.remove("hidden");
    loggedInUser.textContent = `Logged in as ${getUsername()}`;
    loggedInUser.classList.remove("hidden");
    authBtn.textContent = "🔓 Logout";
  }
  fetchActivities();
});
