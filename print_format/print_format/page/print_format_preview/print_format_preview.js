const PAGE_NAME = "print-format-preview"
let icAccountPage;
frappe.pages[PAGE_NAME].on_page_load = async function(wrapper) {
	await frappe.require(
        "pd_preview.bundle.js",
        "india_compliance_account.bundle.css",
    );

    // icAccountPage = new pd_preview.pages.Preview(wrapper PAGE_NAME);
    icAccountPage = new print_format.pages.PrintPreview(wrapper, PAGE_NAME);
}