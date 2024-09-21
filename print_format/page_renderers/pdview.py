import frappe, json

from frappe.www import printview
from frappe import _
from frappe.core.doctype.document_share_key.document_share_key import is_expired
from frappe.utils import escape_html
from frappe.utils.jinja_globals import is_rtl
from print_format.print_format.page.pd_preview.pd_preview import get_template_json

def get_print_context(context):
	"""Build context for print"""
	if not ((frappe.form_dict.doctype and frappe.form_dict.name) or frappe.form_dict.doc):
		return {
			"body": f"""
				<h1>Error</h1>
				<p>Parameters doctype and name required</p>
				<pre>{escape_html(frappe.as_json(frappe.form_dict, indent=2))}</pre>
				"""
		}

	if frappe.form_dict.doc:
		doc = frappe.form_dict.doc
	else:
		doc = frappe.get_doc(frappe.form_dict.doctype, frappe.form_dict.name)

	settings = None

	letterhead = None

	meta = frappe.get_meta(doc.doctype)

	print_format = frappe._dict(get_template_json(frappe.form_dict.format, frappe.form_dict.doctype))

	print_style = None
	body = printview.get_rendered_template(
		doc,
		print_format=print_format,
		meta=meta,
		trigger_print=None,
		no_letterhead=0,
		letterhead=letterhead,
		settings=settings,
	)
	print_style = printview.get_print_style(frappe.form_dict.style, print_format)

	return {
		"body": body,
		"print_style": print_style,
		"comment": frappe.session.user,
		"title": frappe.utils.strip_html(doc.get_title() or doc.name),
		"lang": frappe.local.lang,
		"layout_direction": "rtl" if is_rtl() else "ltr",
		"doctype": frappe.form_dict.doctype,
		"name": frappe.form_dict.docname,
		"key": None,
	}

def validate_print_permission(doc):
	for ptype in ("read", "print"):
		if frappe.has_permission(doc.doctype, ptype, doc) or frappe.has_website_permission(doc):
			return

	key = frappe.form_dict.key
	if key and isinstance(key, str):
		validate_key(key, doc)
	else:
		raise frappe.PermissionError(_("You do not have permission to view this document"))


def validate_key(key, doc):
	document_key_expiry = frappe.get_cached_value(
		"Document Share Key",
		{"reference_doctype": doc.doctype, "reference_docname": doc.name, "key": key},
		["expires_on"],
	)
	if document_key_expiry is not None:
		if is_expired(document_key_expiry[0]):
			raise frappe.exceptions.LinkExpired
		else:
			return

	# TODO: Deprecate this! kept it for backward compatibility
	if frappe.get_system_settings("allow_older_web_view_links") and key == doc.get_signature():
		return

	raise frappe.exceptions.InvalidKeyError
