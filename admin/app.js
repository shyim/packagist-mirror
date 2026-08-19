const loginEl = document.querySelector("#login");
const appEl = document.querySelector("#app");
const logoutEl = document.querySelector("#logout");
const flashEl = document.querySelector("#flash");

async function api(path, options = {}) {
	const response = await fetch(path, {
		credentials: "same-origin",
		...options,
		headers: {
			...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
			...options.headers,
		},
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data.message || response.statusText);
	}
	return data;
}

function flash(message) {
	flashEl.hidden = false;
	flashEl.textContent = message;
}

function showApp(authenticated) {
	loginEl.hidden = authenticated;
	appEl.hidden = !authenticated;
	logoutEl.hidden = !authenticated;
}

async function refresh() {
	const session = await api("/admin/api/session");
	showApp(session.authenticated);
	if (!session.authenticated) {
		return;
	}

	const settings = await api("/admin/api/settings");
	const settingsForm = document.querySelector("#settings-form");
	settingsForm.packagist_enabled.checked = settings.packagist_enabled;
	settingsForm.contact_email.value = settings.contact_email || "";

	const remotes = await api("/admin/api/remotes");
	document.querySelector("#remotes").innerHTML = remotes.remotes
		.map(
			(remote) => `<tr>
        <td><code>/r/${escapeHtml(remote.slug)}</code></td>
        <td>${escapeHtml(remote.url)}</td>
        <td>${escapeHtml(remote.auth_type)}</td>
        <td>${escapeHtml(remote.last_error || "")}</td>
        <td><button class="danger" data-del-remote="${escapeHtml(remote.slug)}">Delete</button></td>
      </tr>`,
		)
		.join("");

	const packages = await api("/admin/api/packages");
	document.querySelector("#packages").innerHTML = packages.packages
		.map(
			(pkg) => `<tr>
        <td><code>${escapeHtml(pkg.name)}</code></td>
        <td>${escapeHtml(pkg.source)}</td>
        <td>${pkg.versions}</td>
        <td>${escapeHtml(pkg.last_error || "")}</td>
        <td>
          ${pkg.source === "vcs" ? `<button data-sync="${escapeHtml(pkg.name)}">Sync</button>` : ""}
          <button class="danger" data-del-pkg="${escapeHtml(pkg.name)}">Delete</button>
        </td>
      </tr>`,
		)
		.join("");
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const token = new FormData(event.target).get("token");
	try {
		await api("/admin/api/login", { method: "POST", body: JSON.stringify({ token }) });
		await refresh();
	} catch (error) {
		flash(error.message);
	}
});

logoutEl.addEventListener("click", async () => {
	await api("/admin/api/logout", { method: "POST", body: "{}" });
	showApp(false);
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.target;
	await api("/admin/api/settings", {
		method: "PUT",
		body: JSON.stringify({
			packagist_enabled: form.packagist_enabled.checked,
			contact_email: form.contact_email.value,
		}),
	});
	flash("Settings saved");
});

document.querySelector("#remote-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = new FormData(event.target);
	const dist = String(form.get("dist_hosts") || "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
	try {
		await api("/admin/api/remotes", {
			method: "POST",
			body: JSON.stringify({
				slug: form.get("slug"),
				url: form.get("url"),
				auth_type: form.get("auth_type"),
				token: form.get("token"),
				username: form.get("username"),
				password: form.get("token"),
				dist_hosts: dist,
			}),
		});
		event.target.reset();
		await refresh();
		flash("Remote added");
	} catch (error) {
		flash(error.message);
	}
});

document.querySelector("#vcs-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = new FormData(event.target);
	try {
		await api("/admin/api/packages/vcs", {
			method: "POST",
			body: JSON.stringify({ url: form.get("url"), token: form.get("token") }),
		});
		event.target.reset();
		await refresh();
		flash("VCS import started");
	} catch (error) {
		flash(error.message);
	}
});

document.querySelector("#upload-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	try {
		await api("/admin/api/packages/upload", { method: "POST", body: new FormData(event.target) });
		event.target.reset();
		await refresh();
		flash("Zip uploaded");
	} catch (error) {
		flash(error.message);
	}
});

document.body.addEventListener("click", async (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return;
	}
	try {
		if (target.dataset.delRemote) {
			await api(`/admin/api/remotes/${target.dataset.delRemote}`, { method: "DELETE" });
			await refresh();
		}
		if (target.dataset.delPkg) {
			await api(`/admin/api/packages?name=${encodeURIComponent(target.dataset.delPkg)}`, { method: "DELETE" });
			await refresh();
		}
		if (target.dataset.sync) {
			await api(`/admin/api/packages/sync?name=${encodeURIComponent(target.dataset.sync)}`, {
				method: "POST",
				body: "{}",
			});
			flash("Sync started");
			await refresh();
		}
	} catch (error) {
		flash(error.message);
	}
});

refresh().catch((error) => flash(error.message));
