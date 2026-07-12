def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "TenderOS backend running"


def test_signup(client):
    r = client.post("/auth/signup", json={"email": "user@test.com", "password": "secret123"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == "user@test.com"


def test_signup_duplicate(client):
    payload = {"email": "dup@test.com", "password": "secret123"}
    assert client.post("/auth/signup", json=payload).status_code == 200
    r = client.post("/auth/signup", json=payload)
    assert r.status_code == 409


def test_signup_short_password(client):
    r = client.post("/auth/signup", json={"email": "x@test.com", "password": "short"})
    assert r.status_code == 400


def test_signup_invalid_email(client):
    r = client.post("/auth/signup", json={"email": "notanemail", "password": "password123"})
    assert r.status_code == 400


def test_login(client):
    client.post("/auth/signup", json={"email": "u@test.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "u@test.com", "password": "password123"})
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_wrong_password(client):
    client.post("/auth/signup", json={"email": "u@test.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "u@test.com", "password": "wrongpassword"})
    assert r.status_code == 401


def test_get_me(client, registered):
    r = client.get("/me", headers=registered)
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"


def test_get_me_no_auth(client):
    r = client.get("/me")
    assert r.status_code == 401


def test_get_me_bad_token(client):
    r = client.get("/me", headers={"Authorization": "Bearer badtoken"})
    assert r.status_code == 401


def test_update_profile(client, registered):
    r = client.put(
        "/me/profile",
        json={"organization_name": "ACME Corp", "contact_name": "Jane", "phone": "01234", "address": "Dhaka"},
        headers=registered,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["organization_name"] == "ACME Corp"
    assert data["contact_name"] == "Jane"
