import frappe, os
import requests
import frappe.printing.doctype.print_format.print_format as print_format
from frappe.utils import file_manager

@frappe.whitelist()
def get_print_format(format):
	if frappe.db.exists("Print Designer Format",format):
		doc = frappe.get_doc("Print Designer Format",format)
		return doc.as_dict()
	return {}

@frappe.whitelist()
def get_template_json(template, doctype):
	doc = frappe.get_doc("Print Format Source Settings").as_dict()
	token = doc["access_token"]
	
	for child in doc["templates"]:
		if child["template_name"] == template and child["document_type"] == doctype:
			headers = {
				"Authorization": f"token {token}",
				"Accept": "application/vnd.github.v3.raw",
			}
			response = requests.get(child["download_url"], headers=headers)
			result = response.json() 
			return result

@frappe.whitelist()
def import_format(name, format, doctype, set_as_default):
	print_doc = get_template_json(format, doctype)
	print_doc["doctype"] = "Print Format"
	print_doc["name"] = name
	p_doc = frappe.get_doc(print_doc).insert()
	if set_as_default == "1":
		print_format.make_default(p_doc.name)

	frappe.clear_messages()
	return p_doc.name
