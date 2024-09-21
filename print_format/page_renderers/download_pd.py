import frappe
import copy

from frappe import _dict
from frappe.translate import print_language
from print_format.page_renderers.pdview import validate_print_permission
from print_format.page_renderers.path_resolver import PathResolver
from print_format.print_format.page.pd_preview.pd_preview import get_template_json
from werkzeug.local import Local # type: ignore
from werkzeug.wrappers import Response # type: ignore

@frappe.whitelist(allow_guest=True)
def download_pdf(doctype, name, format=None, doc=None, no_letterhead=0, language=None, letterhead=None):
	doc = doc or frappe.get_doc(doctype, name)
	validate_print_permission(doc)

	format = get_template_json(name, doctype)
	with print_language(language):
		pdf_file = get_print(
			doctype, name, format, doc=doc, as_pdf=True, letterhead=letterhead, no_letterhead=no_letterhead
		)

	frappe.local.response.filename = "{name}.pdf".format(name=name.replace(" ", "-").replace("/", "-"))
	frappe.local.response.filecontent = pdf_file
	frappe.local.response.type = "pdf"

def get_print(
	doctype=None,
	name=None,
	print_format=None,
	style=None,
	as_pdf=False,
	doc=None,
	output=None,
	no_letterhead=0,
	password=None,
	pdf_options=None,
	letterhead=None,
):
	"""Get Print Format for given document.

	:param doctype: DocType of document.
	:param name: Name of document.
	:param print_format: Print Format name. Default 'Standard',
	:param style: Print Format style.
	:param as_pdf: Return as PDF. Default False.
	:param password: Password to encrypt the pdf with. Default None"""
	from frappe.utils.pdf import get_pdf
	from print_format.page_renderers.download_pd import get_response_without_exception_handling

	local = Local()
	local.form_dict = _dict()

	original_form_dict = copy.deepcopy(local.form_dict)
	try:
		local.form_dict.doctype = doctype
		local.form_dict.name = name
		local.form_dict.format = print_format
		local.form_dict.style = style
		local.form_dict.doc = doc
		local.form_dict.no_letterhead = no_letterhead
		local.form_dict.letterhead = letterhead

		pdf_options = pdf_options or {}
		if password:
			pdf_options["password"] = password

		response = get_response_without_exception_handling("pdview", 200)
		html = str(response.data, "utf-8")
	finally:
		local.form_dict = original_form_dict

	return get_pdf(html, options=pdf_options, output=output) if as_pdf else html

def get_response_without_exception_handling(path=None, http_status_code=200) -> Response:
	"""Resolves path and renders page.

	Note: This doesn't do any exception handling and assumes you'll implement the exception
	handling that's required."""
	path = path or frappe.local.request.path

	path_resolver = PathResolver(path, http_status_code)
	_endpoint, renderer_instance = path_resolver.resolve()
	return renderer_instance.render()

