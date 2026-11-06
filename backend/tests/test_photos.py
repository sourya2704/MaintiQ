from tests.conftest import make_machine, register

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200


def _incident(client, auth):
    m = make_machine(client, auth)
    return client.post("/api/incidents", headers=auth, data={"machine_id": m["id"], "transcript": "Belt is frayed"}).json()


def test_photos_upload_view_and_delete(client, auth):
    inc = _incident(client, auth)
    r = client.post(f"/api/incidents/{inc['id']}/photos", headers=auth,
                    files=[("files", ("a.jpg", JPEG, "image/jpeg")), ("files", ("b.png", PNG, "image/png"))])
    assert r.status_code == 201 and [p["mime_type"] for p in r.json()] == ["image/jpeg", "image/png"]

    detail = client.get(f"/api/incidents/{inc['id']}", headers=auth).json()
    assert len(detail["photos"]) == 2
    photo = detail["photos"][0]["id"]
    img = client.get(f"/api/incidents/{inc['id']}/photos/{photo}", headers=auth)
    assert img.status_code == 200 and img.content == JPEG

    assert client.delete(f"/api/incidents/{inc['id']}/photos/{photo}", headers=auth).status_code == 204
    assert len(client.get(f"/api/incidents/{inc['id']}", headers=auth).json()["photos"]) == 1


def test_photos_reject_non_images_and_other_orgs(client, auth):
    inc = _incident(client, auth)
    bad = client.post(f"/api/incidents/{inc['id']}/photos", headers=auth,
                      files=[("files", ("x.jpg", b"not an image at all", "image/jpeg"))])
    assert bad.status_code == 415
    other = register(client, org="Other", email="o@x.example.com")
    r = client.post(f"/api/incidents/{inc['id']}/photos", headers=other, files=[("files", ("a.jpg", JPEG, "image/jpeg"))])
    assert r.status_code == 404
