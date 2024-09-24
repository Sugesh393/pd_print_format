# Copyright (c) 2024, Aerele and contributors
# For license information, please see license.txt

import frappe, requests
from frappe.model.document import Document
from frappe.utils.password import get_decrypted_password

@frappe.whitelist()
def get_gitInfo():
	doc = frappe.get_doc("Print Format Preview Settings").as_dict()
	url = doc["github_repo"]
	token = get_decrypted_password("Print Format Preview Settings", "Print Format Preview Settings", "access_token")
	url = url.replace("https://github.com/", "")
	api_url = f"https://api.github.com/repos/{url}/contents/"

	headers = {
		"Authorization": f"token {token}",
		"Accept": "application/vnd.github.v3+json",
	}
	response = requests.get(api_url, headers=headers)
	folders = response.json()

	child_table = []
	ref = {}
	for folder in folders:
		print(folder)
		if folder["type"] == "dir":
			files = requests.get(folder["url"], headers=headers).json()
			for file in files:
				ref["folder"] = folder["name"].title().replace("_", " ")
				ref["file"] = file["name"].replace(".json", "")
				ref["url"] = file["download_url"]
				child_table.append(ref)
				ref = {}
	print(child_table)
	return child_table

class PrintFormatPreviewSettings(Document):
	pass