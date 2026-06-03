function requireLogin() {
    const password =
        sessionStorage.getItem(
            "adminPassword"
        );

    if (!password) {
        window.location.href =
            "/admin/index.html";
    }

    return password;
}

function getPassword() {
    return requireLogin();
}
