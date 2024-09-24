// Copyright (c) 2024, Aerele and contributors
// For license information, please see license.txt

frappe.ui.form.on("Print Format Preview Settings", {
    fetch_files: function (frm) {
        frappe.call({
            method: "print_format.print_format.doctype.print_format_preview_settings.print_format_preview_settings.get_gitInfo",
            args: {},
            callback: function (r) {
                if (r.message) {
                    let data_list = r.message;
                    cur_frm.doc.templates = [];
                    data_list.forEach(data => {
                        // Add a row to the child table
                        let child_row = frappe.model.add_child(frm.doc, 'Print Format Templates', 'templates');
            
                        // Set values for each field in the child row
                        child_row.document_type = data.folder;
                        child_row.template_name = data.file;
                        child_row.download_url = data.url;
                    });

                    frm.refresh_field("templates");
                }
            }
        });
    }
});
