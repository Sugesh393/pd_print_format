// const PAGE_NAME = "pd-preview";
// let icAccountPage;

// frappe.pages[PAGE_NAME].on_page_load = async function (wrapper) {
//     await frappe.require(
//         "pd_preview.bundle.js",
//         // "india_compliance_account.bundle.css",
//     );

//     // icAccountPage = new pd_preview.pages.Preview(wrapper PAGE_NAME);
//     icAccountPage = new print_format.pages.PrintPreview(wrapper, PAGE_NAME);
// };




frappe.pages["pd-preview"].on_page_load = function (wrapper) {
	frappe.require(["pdfjs.bundle.css", "print_designer.bundle.css"]);
	frappe.ui.make_app_page({
		parent: wrapper,
	});

	new frappe.ui.form.DesignerView(wrapper);
};

frappe.ui.form.DesignerView = class {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.make();
		this.pdfDoc = null;
		this.pdfDocumentTask = null;
	}

    make() {
        this.print_wrapper = this.page.main.empty().html(
            `<div class="print-preview-wrapper"><div class="print-preview">
                ${frappe.render_template("print_skeleton_loading")}
                <iframe class="print-format-container" width="100%" height="0" frameBorder="0" scrolling="no">
                </iframe>
            </div>
            <div class="page-break-message text-muted text-center text-medium margin-top"></div>
        </div>
        <div class="preview-beta-wrapper">
            <iframe width="100%" height="0" frameBorder="0"></iframe>
        </div>
        `
        );

        this.print_settings = frappe.model.get_doc(":Print Settings", "Print Settings");
        this.setup_toolbar();
        this.setup_sidebar();
        this.setup_keyboard_shortcuts();

        this.print_wrapper = this.page.main.append(
			`<div class="print-designer-wrapper">
				<div id="preview-container" class="preview-container"
					style="background-color: white; position: relative;">
					${frappe.render_template("print_skeleton_loading")}
				</div>
			</div>`
		);

    }

    setup_toolbar() {
		$("[aria-label='Menu']").hide()
        this.refresh_btn = this.page.set_primary_action(__("Refresh"), () => this.refresh_print_format(), {
            icon: "refresh",
        });

        this.import_btn = this.page.add_button(__("Import"), () => this.import_format(this.print_format_selector.val(), this.doctype_selector.val()), {
            icon: "full-page",
        }).hide();
    }

    setup_sidebar() {
        this.sidebar = this.page.sidebar.addClass("print-preview-sidebar");

		this.doctype_item = this.add_sidebar_item({
			fieldtype: "Link",
			fieldname: "doctype",
			options: "DocType",
			label: __("Doctype"),
			reqd: 1,
			
			get_query: () => {
				return { filters: { name: ["in", ["Sales Invoice", "Purchase Order", "Sales Order", "Delivery Note", "Payment Entry"]] } };
			},
			change: () => {
                if(this.doctype_item.value == this.doctype_item.last_value) return;
				if(this.doctype_item.value != this.doctype_item.last_value) {
					this.print_wrapper = this.page.main.empty().html(
						`<div class="print-preview-wrapper"><div class="print-preview">
							${frappe.render_template("print_skeleton_loading")}
							<iframe class="print-format-container" width="100%" height="0" frameBorder="0" scrolling="no">
							</iframe>
						</div>
						<div class="page-break-message text-muted text-center text-medium margin-top"></div>
					</div>
					<div class="preview-beta-wrapper">
						<iframe width="100%" height="0" frameBorder="0"></iframe>
					</div>
					`
					);

					this.print_wrapper = this.page.main.append(
						`<div class="print-designer-wrapper">
							<div id="preview-container" class="preview-container"
								style="background-color: white; position: relative;">
								${frappe.render_template("print_skeleton_loading")}
							</div>
						</div>`
					);
					this.page.set_title();
					frappe.breadcrumbs.add();
					this.import_btn.hide();
				}
				this.docname_selector.val("");
				this.print_format_selector.val("");
				this.language_selector.val("");
			},
		})
        this.doctype_selector = this.doctype_item.$input

		this.docname_item = this.add_sidebar_item({
			fieldtype: "Dynamic Link",
			fieldname: "docname",
			options: "doctype",
			label: __("DocName"),
			reqd: 1,
			change: () => {
                if(this.docname_item.value == this.docname_item.last_value) return;

				if(this.docname_item.value != this.docname_item.last_value && this.docname_item.last_value != null && this.print_format_selector.val()) {
					frappe.call({
						method: "print_format.print_format.page.pd_preview.pd_preview.get_template_json",
						args: {
							template: this.print_format_item.value,
							doctype: this.doctype_selector.val(),
						},
						callback: (r) => {
							if(r.message) {
								let template_json = r.message;
								
								this.frm = { doctype: this.doctype_selector.val(), docname: this.docname_selector.val()};
								frappe.model.with_doc(this.frm.doctype, this.frm.docname, () => {
									this.frm.doc = frappe.get_doc(this.frm.doctype, this.frm.docname);
									frappe.model.with_doctype(this.frm.doctype, () => {
										this.frm.meta = frappe.get_meta(this.frm.doctype);
										this.show(template_json);
									});
								});
							}
						}
					});
				}
			},
		})
        this.docname_selector = this.docname_item.$input;

		this.print_format_item = this.add_sidebar_item({
			fieldtype: "Link",
			fieldname: "print_format",
			options: "Print Format Templates",
			label: __("Print Designer Format"),
			reqd: 1,
			get_query: () => {
				return { filters: { document_type: this.doctype_selector.val() } };
			},
			change: () => {
				if(this.print_format_item.value == this.print_format_item.last_value) return;
				if(!this.print_format_item.value){
					this.import_btn.hide();
					return;
				}	
				
				frappe.call({
					method: "print_format.print_format.page.pd_preview.pd_preview.get_template_json",
					args: {
						template: this.print_format_item.value,
						doctype: this.doctype_selector.val(),
					},
					callback: (r) => {
						if(r.message) {
							let template_json = r.message;
							
							this.frm = { doctype: this.doctype_selector.val(), docname: this.docname_selector.val()};
							frappe.model.with_doc(this.frm.doctype, this.frm.docname, () => {
								this.frm.doc = frappe.get_doc(this.frm.doctype, this.frm.docname);
								frappe.model.with_doctype(this.frm.doctype, () => {
									this.frm.meta = frappe.get_meta(this.frm.doctype);
									this.show(template_json);
								});
							});
						}
					}
				});
			},
		})
        this.print_format_selector = this.print_format_item.$input;
		
		this.language_item = this.add_sidebar_item({
			fieldtype: "Link",
			fieldname: "language",
			label: __("Language"),
			options: "Language",
			change: () => {
                if (this.language_item.value == this.language_item.last_value) return;
				if (this.language_item.value != "") {
					this.set_user_lang();
					this.preview();
				}
			},
		})
        this.language_selector = this.language_item.$input;
    }

    import_format(name, doctype) {
		var d = new frappe.ui.Dialog({
			title: __("Import to Print Format"),
			fields: [
				{
					label: "New Print Format Name",
					fieldname: "name",
					fieldtype: "Data",
					reqd: 1,
				},
				{
					label: "Set as Default",
					fieldname: "default",
					fieldtype: "Check",
				},
			],
			primary_action: function () {
				var data = d.get_values();
				frappe.call({
					method: "print_format.print_format.page.pd_preview.pd_preview.import_format",
					args: {
						name: data.name,
						format: name,
						doctype: doctype,
						set_as_default: data.default,
					},
					callback: function (r) {
						if (!r.exc) {
							if (r.message) {
								frappe.msgprint("Print Format Created Successfully")
							}
							d.hide();
						}
					},
				});
			},
			primary_action_label: __("Create"),
		});
		d.show();
	}

    refresh_print_format() {
		if(!this.doctype_selector.val()){
			frappe.throw("Select Doctype First");
		}
		if(!this.docname_selector.val()){
			frappe.throw("Select Docname First");
		}
		if(!this.print_format_selector.val()){
			frappe.throw("Select Format First");
		}
        this.set_default_print_language();
		this.toggle_raw_printing();
		this.preview();
    }

    set_default_print_language() {
        let print_format = this.get_printdg_format();
		this.lang_code =
			print_format.default_print_language || frappe.boot.lang;

		this.language_selector.val(this.lang_code);
    }

    toggle_raw_printing() {
		const is_raw_printing = this.is_raw_printing();
		this.wrapper.find(".btn-print-preview").toggle(!is_raw_printing);
		this.wrapper.find(".btn-download-pdf").toggle(!is_raw_printing);
	}

    is_raw_printing(format) {
		return this.get_printdg_format().raw_printing === 1;
	}

	set_user_lang() {
		this.lang_code = this.language_selector.val();
	}

	get_printdg_format(format) {
		let pf_name = this.print_format_selector.val(), printdg_format = {};
		if (!format) {
			format = this.selected_format();
		}

		// if (format) {
		// 	try {
		// 		frappe.call({
		// 			method: "print_format.print_format.page.pd_preview.pd_preview.get_print_format",
		// 			args: {
		// 				format: format,
		// 			},
		// 			async: false,
		// 			callback: function (r) {
		// 				if(r) {
		// 					locals["Print Designer Format"] = {};
		// 					locals["Print Designer Format"][format] = r.message;
		// 				}
		// 			}
		// 		});
		// 	}
		// 	catch (error) {
		// 		console.error(error);
		// 	}
		// }
		locals["Print Designer Format"] = {};
		locals["Print Designer Format"][pf_name] = format;

		if (locals["Print Designer Format"] && locals["Print Designer Format"][pf_name])
			printdg_format = locals["Print Designer Format"][pf_name];
		
		return printdg_format;
	}

    preview() {		
		let print_format = this.get_printdg_format(this.format);
        this.print_wrapper.find(".print-preview-wrapper").hide();
        this.print_wrapper.find(".preview-beta-wrapper").hide();
        this.print_wrapper.find(".print-designer-wrapper").show();
        this.designer_pdf(print_format);
		this.import_btn.show();
        this.sidebar.show();
        return;
    }

    hide() {
		if (this.frm.setup_done && this.frm.page.current_view_name === "print") {
			this.frm.page.set_view(
				this.frm.page.previous_view_name === "print"
					? "main"
					: this.frm.page.previous_view_name || "main"
			);
		}
	}

	show(template_json) {
		this.format = template_json;
		if(!this.doctype_selector.val()){
			frappe.throw("Select Doctype First");
		}
		if(!this.docname_selector.val()){
			frappe.throw("Select Docname First");
		}
		this.set_title();
		this.set_breadcrumbs();
		this.setup_customize_dialog();

		// print designer link
		if (Object.keys(frappe.boot.versions).includes("print_designer")) {
			this.page.add_inner_message(`
			<a style="line-height: 2.4" href="/app/print-designer?doctype=${this.frm.doctype}">
			</a>
			`);
		} else {
			this.page.add_inner_message(`
			<a style="line-height: 2.4" href="https://frappecloud.com/marketplace/apps/print_designer?utm_source=framework-desk&utm_medium=print-view&utm_campaign=try-link">
			</a>
			`);
		}
		let tasks = [
			this.set_default_print_language,
			this.preview,
		].map((fn) => fn.bind(this));

		return frappe.run_serially(tasks);
	}

    async designer_pdf(print_format) {
		if (typeof pdfjsLib == "undefined") {
			await frappe.require(
				["assets/print_designer/js/pdf.min.js", "pdf.worker.bundle.js"],
				() => {
					pdfjsLib.GlobalWorkerOptions.workerSrc =
						frappe.boot.assets_json["pdf.worker.bundle.js"];
				}
			);
		}
		let me = this;
		let print_designer_settings = JSON.parse(print_format.print_designer_settings);
		let page_settings = print_designer_settings.page;
		let canvasContainer = document.getElementById("preview-container");
		canvasContainer.style.minHeight = page_settings.height + "px";
		canvasContainer.style.width = page_settings.width + "px";
		canvasContainer.innerHTML = `${frappe.render_template("print_skeleton_loading")}`;
		canvasContainer.style.backgroundColor = "white";
		
		let params = new URLSearchParams({
			doctype: this.frm.doc.doctype,
			name: this.frm.doc.name,
			format: this.print_format_selector.val(),
			_lang: this.lang_code,
		});
		let url = `${
			window.location.origin
		}/api/method/print_format.page_renderers.download_pd.download_pdf?${params.toString()}`;

		/**
		 * Asynchronously downloads PDF.
		 */
		try {
			this.pdfDocumentTask && this.pdfDocumentTask.destroy();
			this.pdfDocumentTask = await pdfjsLib.getDocument(url);
			this.pdfDoc = await this.pdfDocumentTask.promise;
			
			// Initial/first page rendering
			canvasContainer.innerHTML = "";
			canvasContainer.style.backgroundColor = "transparent";
			for (let pageno = 1; pageno <= this.pdfDoc.numPages; pageno++) {				
				await renderPage(this.pdfDoc, pageno);
			}
			if (frappe.route_options.trigger_print) {
				this.printit();
			}
			
		} catch (err) {
			console.error(err);
			frappe.msgprint({
				title: __("Unable to generate PDF"),
				message: `There was error while generating PDF. Please check the error log for more details.`,
				indicator: "red",
				primary_action: {
					label: "Open Error Log",
					action(values) {
						frappe.set_route("List", "Error Log", {
							doctype: "Error Log",
							reference_doctype: "Print Designer Format",
						});
					},
				},
			});
		}
        /**
		 * Get page info from document, resize canvas accordingly, and render page.
		 * @param num Page number.
        */
        async function renderPage(pdfDoc, num) {
            // Using promise to fetch the page
            let page = await pdfDoc.getPage(num);			
            let canvasContainer = document.getElementById("preview-container");
            let canvas = document.createElement("canvas");
            let textLayer = document.createElement("div");
            textLayer.classList.add("textLayer");
            textLayer.style.position = "absolute";
            textLayer.style.left = 0;
            textLayer.style.top = 0;
            textLayer.style.right = 0;
            textLayer.style.bottom = 0;
            textLayer.style.overflow = "hidden";
            textLayer.style.opacity = 0.2;
            textLayer.style.lineHeight = 1.0;
            canvas.style.marginTop = "6px";
            canvasContainer.appendChild(canvas);
            canvasContainer.appendChild(textLayer);
            let ctx = canvas.getContext("2d");
            let viewport = page.getViewport({ scale: 1 });
            let scale = (page_settings.width / viewport.width) * window.devicePixelRatio * 1.5;
            document.documentElement.style.setProperty(
                "--scale-factor",
                page_settings.width / viewport.width
            );
            let scaledViewport = page.getViewport({ scale: scale });
            canvas.style.height = page_settings.height + "px";
            canvas.style.width = page_settings.width + "px";
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;

            // Render PDF page into canvas context
            let renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport,
                intent: "print",
            };
            await page.render(renderContext);
            let textContent = await page.getTextContent();
			
            // Assign CSS to the textLayer element
            textLayer.style.left = canvas.offsetLeft + "px";
            textLayer.style.top = canvas.offsetTop + "px";
            textLayer.style.height = canvas.offsetHeight + "px";
            textLayer.style.width = canvas.offsetWidth + "px";

            // Pass the data to the method for rendering of text over the pdf canvas.
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: scaledViewport,
                textDivs: [],
            });
        }
    }

    printit() {
        if (!this.pdfDoc) return;
        this.pdfDoc.getData().then((arrBuff) => {
            let file = new Blob([arrBuff], { type: "application/pdf" });
            let fileUrl = URL.createObjectURL(file);
            let iframe;
            let iframeAvailable = document.getElementById("blob-print-iframe");
            if (!iframeAvailable) {
                iframe = document.createElement("iframe");
                iframe.id = "blob-print-iframe";
                iframe.style.display = "none";
                iframe.src = fileUrl;
                document.body.appendChild(iframe);
                iframe.onload = () => {
                    setTimeout(() => {
                        iframe.focus();
                        iframe.contentWindow.print();
                        if (frappe.route_options.trigger_print) {
                            setTimeout(function () {
                                window.close();
                            }, 5000);
                        }
                    }, 1);
                };
            } else {
                iframeAvailable.src = fileUrl;
            }
            // in case the Blob uses a lot of memory
            setTimeout(() => URL.revokeObjectURL(fileUrl), 7000);
        });
        return;
    }

    set_title() {
		this.page.set_title(this.frm.docname);
	}

    set_breadcrumbs() {
		frappe.breadcrumbs.add(this.frm.meta.module, this.frm.doctype);
	}

    setup_customize_dialog() {
		let print_format = this.get_printdg_format();
		$(document).on("new-print-format", (e) => {
			frappe.prompt(
				[
					{
						label: __("New Print Format Name"),
						fieldname: "print_format_name",
						fieldtype: "Data",
						reqd: 1,
					},
					{
						label: __("Based On"),
						fieldname: "based_on",
						fieldtype: "Read Only",
						default: print_format.name || "Standard",
					},
				],
				(data) => {
					frappe.route_options = {
						make_new: true,
						doctype: this.frm.doctype,
						name: data.print_format_name,
						based_on: data.based_on,
					};
					frappe.set_route("print-format-builder");
				},
				__("New Custom Print Format"),
				__("Start")
			);
		});
	}

	
	selected_format() {		
		return this.format || "Standard";
	}

	add_sidebar_item(df, is_dynamic) {
		if (df.fieldtype == "Select") {
			df.input_class = "btn btn-default btn-sm text-left";
		}

		let field = frappe.ui.form.make_control({
			df: df,
			parent: is_dynamic ? this.sidebar_dynamic_section : this.sidebar,
			render_input: 1,
		});

		if (df.default != null) {
			field.set_input(df.default);
		}

		return field;
	}

	setup_keyboard_shortcuts() {
		this.wrapper.find(".print-toolbar a.btn-default").each((i, el) => {
			frappe.ui.keys.get_shortcut_group(this.frm.page).add($(el));
		});
	}
}
